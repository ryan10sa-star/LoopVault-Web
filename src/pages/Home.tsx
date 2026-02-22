import { useLiveQuery } from 'dexie-react-hooks';
import { Database, QrCode, Tags } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { parseTagsCsv } from '../components/CsvImporter';
import { db, upsertTagsBulk } from '../db';

export function Home(): JSX.Element {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [lastBackupAt, setLastBackupAt] = useState<string>('');

  const tags = useLiveQuery(async () => await db.tags.toArray(), [], []);
  const jobs = useLiveQuery(async () => await db.jobs.toArray(), [], []);
  const steps = useLiveQuery(async () => await db.steps.toArray(), [], []);

  const activeCount = jobs.filter((job) => job.status === 'in-progress').length;
  const suspendedCount = jobs.filter((job) => job.status === 'suspended').length;
  const exceptionCount = jobs.filter((job) => {
    if (typeof job.id !== 'number') {
      return false;
    }
    return steps.some((step) => step.jobId === job.id && step.passFail === 'fail');
  }).length;
  const nextBestAction =
    tags.length === 0
      ? { label: 'Import your master tags to initialize field workflow.', to: '/tags' }
      : activeCount > 0
        ? { label: `Resume ${activeCount} active job(s) to keep progress moving.`, to: '/exceptions' }
        : exceptionCount > 0 || suspendedCount > 0
          ? { label: 'Review unresolved exceptions/suspended jobs in the supervisor queue.', to: '/exceptions' }
          : { label: 'Start scanning or open a tag to begin the next job.', to: '/scanner' };

  useEffect(() => {
    const isComplete = localStorage.getItem('loopvault.onboardingComplete.v1') === 'true';
    setShowOnboarding(!isComplete);
    setLastBackupAt(localStorage.getItem('loopvault:lastBackupAt') ?? '');
  }, []);

  const backupAgeDays = useMemo(() => {
    if (!lastBackupAt) {
      return null;
    }
    const parsed = new Date(lastBackupAt);
    if (!Number.isFinite(parsed.getTime())) {
      return null;
    }
    return Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
  }, [lastBackupAt]);

  const onImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const onCsvSelected = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const tags = parseTagsCsv(content);
      if (tags.length === 0) {
        throw new Error('No valid tags found in CSV.');
      }
      await upsertTagsBulk(tags);
      setStatus(`Imported ${tags.length} tag(s). Redirecting to tags...`);
      setError('');
      navigate('/tags');
    } catch (importError) {
      setError(importError instanceof Error ? `CSV import failed: ${importError.message}` : 'CSV import failed.');
      setStatus('');
    }
  };

  const onImportSamplePack = async (path: string, label: string): Promise<void> => {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error('Sample file could not be loaded.');
      }
      const content = await response.text();
      const tags = parseTagsCsv(content);
      if (tags.length === 0) {
        throw new Error('No valid tags found in sample file.');
      }
      await upsertTagsBulk(tags);
      setStatus(`Imported ${tags.length} tag(s) from ${label}. Redirecting to tags...`);
      setError('');
      navigate('/tags');
    } catch (importError) {
      setError(importError instanceof Error ? `Sample import failed: ${importError.message}` : 'Sample import failed.');
      setStatus('');
    }
  };

  const onCompleteOnboarding = (): void => {
    localStorage.setItem('loopvault.onboardingComplete.v1', 'true');
    setShowOnboarding(false);
  };

  return (
    <section className="lv-page">
      <header className="space-y-1 text-center">
        <h2 className="lv-title text-2xl">LoopVault Web</h2>
        <p className="lv-subtitle">Field Dashboard</p>
      </header>

      <section className="lv-panel">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Operations Console</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <p className="lv-kpi">Tags: {tags.length}</p>
          <p className="lv-kpi">Active Jobs: {activeCount}</p>
          <p className="lv-kpi">Suspended: {suspendedCount}</p>
          <p className="lv-kpi">Exceptions: {exceptionCount}</p>
        </div>
      </section>

      <section className="lv-panel">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Next Best Action</p>
        <p className="mt-1 text-sm text-amber-100">{nextBestAction.label}</p>
        <Link className="lv-btn-secondary mt-2" to={nextBestAction.to}>
          Open
        </Link>
      </section>

      <section className="lv-panel-quiet text-xs text-slate-300">
        <p className="font-semibold text-slate-200">Offline Confidence</p>
        <p className="mt-1">Safe now: capture tags, jobs, notes, signatures, photos, and documents fully offline.</p>
        <p>Do later: export backup ZIP routinely and distribute final reports.</p>
        {backupAgeDays === null ? <p className="mt-2 text-amber-300">No backup export recorded on this device yet.</p> : null}
        {typeof backupAgeDays === 'number' ? (
          <p className={`mt-2 ${backupAgeDays > 7 ? 'text-red-300' : 'text-emerald-300'}`}>
            Last backup: {backupAgeDays} day(s) ago {backupAgeDays > 7 ? '(stale, export now)' : ''}
          </p>
        ) : null}
      </section>

      {showOnboarding ? (
        <section className="lv-panel space-y-2 border-safety">
          <p className="text-sm font-semibold text-safety">First-Run Setup (3 Steps)</p>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-200">
            <li>Import tags (CSV or sample pack).</li>
            <li>Set role and site settings.</li>
            <li>Open Exceptions dashboard after first active jobs.</li>
          </ol>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link className="lv-btn-secondary" to="/settings">
              Open Settings
            </Link>
            <button className="lv-btn-primary" onClick={onCompleteOnboarding} type="button">
              Mark Setup Complete
            </button>
          </div>
        </section>
      ) : null}

      <Link className="lv-btn-primary min-h-16 gap-2 text-lg" to="/scanner">
        <QrCode size={22} /> Scan QR
      </Link>

      {status ? <p aria-live="polite" className="rounded-lg border border-emerald-400 bg-emerald-950 p-3 text-sm font-semibold text-emerald-100">✓ {status}</p> : null}
      {error ? <p aria-live="assertive" className="rounded-lg border border-red-500 bg-red-950 p-3 text-sm">{error}</p> : null}

      <div className="grid gap-3">
        <button className="lv-btn-primary min-h-16 gap-2 text-lg" onClick={onImportClick} type="button">
          <Database size={22} /> Import Tags
        </button>
        <input accept=".csv,text/csv" className="hidden" onChange={(event) => void onCsvSelected(event)} ref={fileInputRef} type="file" />

        <Link className="lv-btn-secondary min-h-16 gap-2 text-lg" to="/tags">
          <Tags size={22} /> Tags
        </Link>

        <Link className="lv-btn-secondary min-h-16 text-lg" to="/exceptions">
          Exceptions Queue
        </Link>

        <Link className="lv-btn-secondary min-h-16 text-lg" to="/help">
          Help & Docs
        </Link>

        <Link className="lv-btn-secondary min-h-16 text-lg" to="/settings">
          Settings
        </Link>

        <Link className="lv-btn-secondary min-h-16 text-lg" to="/handover">
          Handover
        </Link>

        <Link className="lv-btn-secondary min-h-16 text-lg" to="/diagnostics">
          Diagnostics
        </Link>
      </div>

      <div className="space-y-1 text-center">
        <a className="text-sm text-safety underline" href="/sample-tags.csv">
          Download sample tags CSV (basic)
        </a>
        <br />
        <a className="text-sm text-safety underline" href="/sample-tags-advanced.csv">
          Download sample tags CSV (advanced demo)
        </a>
      </div>

      <section className="lv-panel space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Quick Import Sample Packs</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="lv-btn-secondary" onClick={() => void onImportSamplePack('/sample-tags.csv', 'basic sample pack')} type="button">
            Import Basic Sample
          </button>
          <button className="lv-btn-secondary" onClick={() => void onImportSamplePack('/sample-tags-advanced.csv', 'advanced sample pack')} type="button">
            Import Advanced Sample
          </button>
        </div>
      </section>
    </section>
  );
}
