import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StatusChip } from '../components/StatusChip';
import { db, type JobEntity, type StepEntity, type TagEntity } from '../db';

interface ExceptionRow {
  jobId: number;
  tagNumber: string;
  status: JobEntity['status'];
  failCount: number;
  equipmentDue: string;
  severity: 'High' | 'Medium';
  category: string;
  ageLabel: string;
  ageBucket: 'lt24' | 'lt72' | 'gt168' | 'unknown';
}

export function Exceptions(): JSX.Element {
  const navigate = useNavigate();
  const tags = useLiveQuery(async () => await db.tags.toArray(), [], []) as TagEntity[];
  const jobs = useLiveQuery(async () => await db.jobs.toArray(), [], []) as JobEntity[];
  const steps = useLiveQuery(async () => await db.steps.toArray(), [], []) as StepEntity[];

  const queue = useMemo(() => {
    const stepsByJob = new Map<number, StepEntity[]>();
    steps.forEach((step) => {
      stepsByJob.set(step.jobId, [...(stepsByJob.get(step.jobId) ?? []), step]);
    });

    const tagById = new Map<number, TagEntity>();
    tags.forEach((tag) => {
      if (typeof tag.id === 'number') {
        tagById.set(tag.id, tag);
      }
    });

    const rows: ExceptionRow[] = [];
    jobs.forEach((job) => {
      if (typeof job.id !== 'number') {
        return;
      }
      const failCount = (stepsByJob.get(job.id) ?? []).filter((step) => step.passFail === 'fail').length;
      const isException = failCount > 0 || job.status === 'suspended';
      if (!isException) {
        return;
      }
      const tag = tagById.get(job.tagId);
      rows.push({
        jobId: job.id,
        tagNumber: tag?.tagNumber ?? `Tag#${job.tagId}`,
        status: job.status,
        failCount,
        equipmentDue: tag?.testEquipmentCalDate ?? '',
        severity: job.status === 'suspended' || failCount >= 2 ? 'High' : 'Medium',
        category: String(job.configValues?.exceptionCategory ?? '').trim() || 'Unclassified',
        ...computeAgeMeta(job.createdAt)
      });
    });

    return rows.sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === 'High' ? -1 : 1;
      }
      if (left.status !== right.status) {
        if (left.status === 'suspended') {
          return -1;
        }
        if (right.status === 'suspended') {
          return 1;
        }
      }
      return right.failCount - left.failCount;
    });
  }, [jobs, steps, tags]);

  const dueRows = useMemo(() => {
    return tags
      .map((tag) => ({
        tagNumber: tag.tagNumber,
        due: getDueState(tag.testEquipmentCalDate)
      }))
      .filter((row) => row.due !== null)
      .sort((left, right) => (left.due?.priority ?? 99) - (right.due?.priority ?? 99))
      .slice(0, 20);
  }, [tags]);

  const agingSummary = useMemo(() => {
    return {
      lt24: queue.filter((row) => row.ageBucket === 'lt24').length,
      lt72: queue.filter((row) => row.ageBucket === 'lt72').length,
      gt168: queue.filter((row) => row.ageBucket === 'gt168').length,
      unknown: queue.filter((row) => row.ageBucket === 'unknown').length
    };
  }, [queue]);

  return (
    <section className="lv-page">
      <header className="lv-panel">
        <h2 className="lv-title">Exceptions & Due Tracking</h2>
        <p className="lv-subtitle">Supervisor queue for unresolved jobs and upcoming/overdue test equipment calibration dates.</p>
      </header>

      <div className="lv-panel grid grid-cols-2 gap-2 text-sm text-slate-200">
        <p className="lv-kpi">Exception Jobs: {queue.length}</p>
        <p className="lv-kpi">Due/Overdue Tags: {dueRows.length}</p>
        <p className="lv-kpi">Aging &lt;24h: {agingSummary.lt24}</p>
        <p className="lv-kpi">Aging 24-72h: {agingSummary.lt72}</p>
        <p className="lv-kpi">Aging &gt;7d: {agingSummary.gt168}</p>
        <p className="lv-kpi">Aging Unknown: {agingSummary.unknown}</p>
      </div>

      <section className="lv-panel border-red-500 bg-red-950/25">
        <h3 className="text-base font-semibold text-red-200">Exception Queue</h3>
        {queue.length === 0 ? <p className="mt-2 text-sm text-red-100">No unresolved exception jobs.</p> : null}
        {queue.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {queue.map((row) => (
              <li className="rounded-xl border border-red-400 bg-red-950/35 p-3" key={row.jobId}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-red-100">{row.tagNumber} • Job #{row.jobId}</p>
                  <StatusChip label={row.severity} tone={row.severity === 'High' ? 'danger' : 'warning'} />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <StatusChip label={formatStatus(row.status)} tone={row.status === 'suspended' ? 'warning' : 'caution'} />
                  <p className="text-xs text-red-100">Failed checks: {row.failCount}</p>
                </div>
                <p className="text-xs text-red-100">Category: {row.category} • Age: {row.ageLabel}</p>
                {row.equipmentDue ? <p className="text-xs text-red-100">Equipment Cal Due: {row.equipmentDue}</p> : null}
                <p className="mt-1 text-xs text-red-100">Action: {row.status === 'suspended' ? 'Resume or cancel with disposition.' : 'Resolve failed checks and document disposition.'}</p>
                <div className="mt-2 flex gap-2">
                  <button className="lv-btn-secondary min-h-[36px] px-3 py-2 text-xs" onClick={() => navigate(`/jobs/${row.jobId}`)} type="button">
                    Open Job
                  </button>
                  <button className="lv-btn-secondary min-h-[36px] px-3 py-2 text-xs" onClick={() => navigate(`/tags/${encodeURIComponent(row.tagNumber)}`)} type="button">
                    Open Tag
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="lv-panel border-amber-500 bg-amber-950/25">
        <h3 className="text-base font-semibold text-amber-200">Calibration Due Watchlist</h3>
        {dueRows.length === 0 ? <p className="mt-2 text-sm text-amber-100">No upcoming or overdue equipment calibration dates.</p> : null}
        {dueRows.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {dueRows.map((row) => (
              <li className="rounded-xl border border-amber-400 bg-amber-950/35 p-3" key={`${row.tagNumber}-${row.due?.label ?? ''}`}>
                <p className="text-sm font-semibold text-amber-100">{row.tagNumber}</p>
                <p className={`text-xs ${row.due?.tone === 'red' ? 'text-red-300' : 'text-amber-100'}`}>{row.due?.label}</p>
                <button className="lv-btn-secondary mt-2 min-h-[36px] px-3 py-2 text-xs" onClick={() => navigate(`/tags/${encodeURIComponent(row.tagNumber)}`)} type="button">
                  Open Tag
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Link className="lv-btn-secondary" to="/tags">
        Go to Tags
      </Link>
    </section>
  );
}

function formatStatus(status: JobEntity['status']): string {
  if (status === 'in-progress') {
    return 'In Progress';
  }
  if (status === 'suspended') {
    return 'Suspended';
  }
  if (status === 'cancelled') {
    return 'Cancelled';
  }
  return 'Completed';
}

function getDueState(rawDate: string): { label: string; tone: 'red' | 'amber'; priority: number } | null {
  const value = String(rawDate ?? '').trim();
  if (!value) {
    return null;
  }
  const due = new Date(value);
  if (!Number.isFinite(due.getTime())) {
    return { label: `Invalid calibration due date (${value})`, tone: 'amber', priority: 2 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const days = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) {
    return { label: `${value} • ${Math.abs(days)} day(s) overdue`, tone: 'red', priority: 0 };
  }
  if (days <= 30) {
    return { label: `${value} • due in ${days} day(s)`, tone: 'amber', priority: 1 };
  }
  return null;
}

function computeAgeMeta(createdAt?: string): { ageLabel: string; ageBucket: 'lt24' | 'lt72' | 'gt168' | 'unknown' } {
  const raw = String(createdAt ?? '').trim();
  if (!raw) {
    return { ageLabel: 'Unknown', ageBucket: 'unknown' };
  }
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return { ageLabel: 'Unknown', ageBucket: 'unknown' };
  }
  const ageHours = Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60));
  if (ageHours < 24) {
    return { ageLabel: `${ageHours}h`, ageBucket: 'lt24' };
  }
  if (ageHours < 72) {
    return { ageLabel: `${ageHours}h`, ageBucket: 'lt72' };
  }
  if (ageHours >= 168) {
    return { ageLabel: `${Math.floor(ageHours / 24)}d`, ageBucket: 'gt168' };
  }
  return { ageLabel: `${Math.floor(ageHours / 24)}d`, ageBucket: 'lt72' };
}
