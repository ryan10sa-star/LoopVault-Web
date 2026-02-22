import { useEffect, useMemo, useState } from 'react';

type HandoverRole = 'tech' | 'lead';
type ExportFormat = 'txt' | 'csv';

interface HandoverFormData {
  unitArea: string;
  shiftWindow: string;
  handoverBy: string;
  completedJobs: string;
  openJobs: string;
  blockers: string;
  evidenceGaps: string;
  calibrationExceptions: string;
  backupStatus: string;
  nextShiftPriorities: string;
  safetyNotes: string;
  roleSpecific: string;
}

interface HandoverHistoryEntry {
  id: string;
  role: HandoverRole;
  format: ExportFormat;
  exportedAt: string;
  unitArea: string;
  shiftWindow: string;
  handoverBy: string;
}

const STORAGE_KEY = 'loopvault.handoverDraft.v1';
const HISTORY_STORAGE_KEY = 'loopvault.handoverHistory.v1';
const HISTORY_REMINDER_KEY = 'loopvault.handoverHistoryReminderDate.v1';
const HISTORY_LIMIT = 7;

const EMPTY_FORM: HandoverFormData = {
  unitArea: '',
  shiftWindow: '',
  handoverBy: '',
  completedJobs: '',
  openJobs: '',
  blockers: '',
  evidenceGaps: '',
  calibrationExceptions: '',
  backupStatus: '',
  nextShiftPriorities: '',
  safetyNotes: '',
  roleSpecific: ''
};

export function Handover(): JSX.Element {
  const [role, setRole] = useState<HandoverRole>('tech');
  const [form, setForm] = useState<HandoverFormData>(EMPTY_FORM);
  const [status, setStatus] = useState<string>('');
  const [history, setHistory] = useState<HandoverHistoryEntry[]>([]);
  const [showArchivePrompt, setShowArchivePrompt] = useState<boolean>(false);
  const [showDailyArchiveReminder, setShowDailyArchiveReminder] = useState<boolean>(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { role?: HandoverRole; form?: Partial<HandoverFormData> };
      if (parsed.role === 'tech' || parsed.role === 'lead') {
        setRole(parsed.role);
      }
      if (parsed.form) {
        setForm({ ...EMPTY_FORM, ...parsed.form });
      }
      setStatus('Loaded saved handover draft.');
    } catch {
      setStatus('Saved draft was invalid and could not be loaded.');
    }
  }, []);

  useEffect(() => {
    const rawHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!rawHistory) {
      return;
    }

    try {
      const parsed = JSON.parse(rawHistory) as HandoverHistoryEntry[];
      if (!Array.isArray(parsed)) {
        return;
      }
      const cleaned = parsed
        .filter((entry) => entry && (entry.role === 'tech' || entry.role === 'lead') && (entry.format === 'txt' || entry.format === 'csv'))
        .slice(0, HISTORY_LIMIT);
      setHistory(cleaned);
      setShowArchivePrompt(cleaned.length >= HISTORY_LIMIT);
    } catch {
      setStatus('Stored history was invalid and could not be loaded.');
    }
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({ role, form });
    localStorage.setItem(STORAGE_KEY, payload);
  }, [role, form]);

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    setShowArchivePrompt(history.length >= HISTORY_LIMIT);
  }, [history]);

  useEffect(() => {
    if (history.length < HISTORY_LIMIT) {
      setShowDailyArchiveReminder(false);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const lastReminderDate = localStorage.getItem(HISTORY_REMINDER_KEY);
    if (lastReminderDate === today) {
      setShowDailyArchiveReminder(false);
      return;
    }

    localStorage.setItem(HISTORY_REMINDER_KEY, today);
    setShowDailyArchiveReminder(true);
  }, [history.length]);

  const roleSpecificLabel = useMemo(() => {
    return role === 'lead' ? 'Lead Notes (crew allocation, permits, critical path, approvals)' : 'Tech Notes (instrument status, punch list, next checks)';
  }, [role]);

  const onFieldChange = (field: keyof HandoverFormData, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const onClear = (): void => {
    setForm(EMPTY_FORM);
    setStatus('Draft cleared.');
  };

  const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const appendHistory = (format: ExportFormat): void => {
    const entry: HandoverHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role,
      format,
      exportedAt: new Date().toISOString(),
      unitArea: form.unitArea,
      shiftWindow: form.shiftWindow,
      handoverBy: form.handoverBy
    };

    setHistory((current) => {
      const next = [entry, ...current].slice(0, HISTORY_LIMIT);
      return next;
    });

    if (history.length >= HISTORY_LIMIT) {
      setStatus('History limit reached (7). Export archive to a device folder for long-term storage and recall.');
      setShowArchivePrompt(true);
    }
  };

  const onExportTxt = (): void => {
    const lines = [
      `LoopVault Shift Handover (${role.toUpperCase()})`,
      '',
      `Unit/Area: ${form.unitArea}`,
      `Shift Window: ${form.shiftWindow}`,
      `Handover By: ${form.handoverBy}`,
      '',
      `Completed Tags/Jobs: ${form.completedJobs}`,
      `Open Tags/Jobs: ${form.openJobs}`,
      `Blocked Items / Permits / Access Issues: ${form.blockers}`,
      `Evidence Gaps: ${form.evidenceGaps}`,
      `Calibration Exceptions / OOT: ${form.calibrationExceptions}`,
      `Export & Backup Status: ${form.backupStatus}`,
      `Next Shift Priorities: ${form.nextShiftPriorities}`,
      `Safety / Operational Notes: ${form.safetyNotes}`,
      `${roleSpecificLabel}: ${form.roleSpecific}`
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `handover-${role}-${Date.now()}.txt`);
    appendHistory('txt');
    setStatus('TXT handover exported.');
  };

  const onExportCsv = (): void => {
    const headers = [
      'role',
      'unit_area',
      'shift_window',
      'handover_by',
      'completed_jobs',
      'open_jobs',
      'blockers',
      'evidence_gaps',
      'calibration_exceptions',
      'backup_status',
      'next_shift_priorities',
      'safety_notes',
      'role_specific'
    ];

    const values = [
      role,
      form.unitArea,
      form.shiftWindow,
      form.handoverBy,
      form.completedJobs,
      form.openJobs,
      form.blockers,
      form.evidenceGaps,
      form.calibrationExceptions,
      form.backupStatus,
      form.nextShiftPriorities,
      form.safetyNotes,
      form.roleSpecific
    ].map((cell) => `"${String(cell).replaceAll('"', '""')}"`);

    const csv = `${headers.join(',')}\n${values.join(',')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `handover-${role}-${Date.now()}.csv`);
    appendHistory('csv');
    setStatus('CSV handover exported.');
  };

  const onExportHistoryArchive = (): void => {
    if (history.length === 0) {
      setStatus('No history records to archive.');
      return;
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      records: history
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, `handover-history-archive-${Date.now()}.json`);
    setStatus('History archive exported. Save it in your long-term folder.');
  };

  const onImportHistoryArchive = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as { records?: HandoverHistoryEntry[] };
      const records = Array.isArray(parsed.records)
        ? parsed.records.filter((entry) => entry && (entry.role === 'tech' || entry.role === 'lead') && (entry.format === 'txt' || entry.format === 'csv'))
        : [];

      const merged = [...records, ...history]
        .filter((entry, index, list) => list.findIndex((item) => item.id === entry.id) === index)
        .sort((left, right) => right.exportedAt.localeCompare(left.exportedAt))
        .slice(0, HISTORY_LIMIT);

      setHistory(merged);
      setStatus(`Imported history archive (${records.length} record(s)).`);
      event.currentTarget.value = '';
    } catch {
      setStatus('Failed to import history archive.');
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Shift Handover</h2>
      <p className="text-sm text-slate-300">Create a structured handover for either technician-level or lead-level shift transitions. Drafts auto-save offline on this device.</p>

      <div className="grid grid-cols-2 gap-2">
        <button
          className={`min-h-[44px] rounded-lg px-4 py-3 text-sm font-bold ${role === 'tech' ? 'bg-safety text-black' : 'bg-slate-100 text-slate-900'}`}
          onClick={() => setRole('tech')}
          type="button"
        >
          Tech
        </button>
        <button
          className={`min-h-[44px] rounded-lg px-4 py-3 text-sm font-bold ${role === 'lead' ? 'bg-safety text-black' : 'bg-slate-100 text-slate-900'}`}
          onClick={() => setRole('lead')}
          type="button"
        >
          Lead
        </button>
      </div>

      {status ? <p className="rounded-lg border border-emerald-400 bg-emerald-950 p-3 text-sm font-semibold text-emerald-100">✓ {status}</p> : null}

      {showDailyArchiveReminder ? (
        <section className="space-y-2 rounded-xl border border-amber-400 bg-amber-950/40 p-4">
          <h3 className="text-sm font-semibold text-amber-200">Daily Archive Reminder</h3>
          <p className="text-xs text-amber-100">History is full (7/7). Export the archive and save it in your long-term folder for retention and off-app recall.</p>
          <div className="flex flex-wrap gap-2">
            <button className="min-h-[44px] rounded-lg bg-safety px-3 py-2 text-sm font-bold text-black" onClick={onExportHistoryArchive} type="button">
              Export History Archive
            </button>
            <button
              className="min-h-[44px] rounded-lg border border-slate-400 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900"
              onClick={() => setShowDailyArchiveReminder(false)}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      <div className="space-y-3">
        <TextField label="Unit/Area" value={form.unitArea} onChange={(value) => onFieldChange('unitArea', value)} />
        <TextField label="Shift Window" value={form.shiftWindow} onChange={(value) => onFieldChange('shiftWindow', value)} />
        <TextField label="Handover By" value={form.handoverBy} onChange={(value) => onFieldChange('handoverBy', value)} />
        <TextAreaField label="Completed Tags/Jobs" value={form.completedJobs} onChange={(value) => onFieldChange('completedJobs', value)} />
        <TextAreaField label="Open Tags/Jobs (with status)" value={form.openJobs} onChange={(value) => onFieldChange('openJobs', value)} />
        <TextAreaField label="Blocked Items / Permits / Access Issues" value={form.blockers} onChange={(value) => onFieldChange('blockers', value)} />
        <TextAreaField label="Evidence Gaps to Capture Next Shift" value={form.evidenceGaps} onChange={(value) => onFieldChange('evidenceGaps', value)} />
        <TextAreaField
          label="Calibration Exceptions / Out-of-Tolerance Findings"
          value={form.calibrationExceptions}
          onChange={(value) => onFieldChange('calibrationExceptions', value)}
        />
        <TextAreaField label="Export & Backup Status (PDF + ZIP)" value={form.backupStatus} onChange={(value) => onFieldChange('backupStatus', value)} />
        <TextAreaField label="Priority Start List for Next Shift" value={form.nextShiftPriorities} onChange={(value) => onFieldChange('nextShiftPriorities', value)} />
        <TextAreaField label="Safety / Operational Notes" value={form.safetyNotes} onChange={(value) => onFieldChange('safetyNotes', value)} />
        <TextAreaField label={roleSpecificLabel} value={form.roleSpecific} onChange={(value) => onFieldChange('roleSpecific', value)} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button className="min-h-[44px] rounded-lg bg-safety px-3 py-2 text-sm font-bold text-black" onClick={onExportTxt} type="button">
          Export TXT
        </button>
        <button className="min-h-[44px] rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900" onClick={onExportCsv} type="button">
          Export CSV
        </button>
        <button className="min-h-[44px] rounded-lg border border-slate-400 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900" onClick={onClear} type="button">
          Clear
        </button>
      </div>

      {showArchivePrompt ? (
        <section className="space-y-2 rounded-xl border border-amber-400 bg-amber-950/40 p-4">
          <h3 className="text-sm font-semibold text-amber-200">History Limit Reached (7)</h3>
          <p className="text-xs text-amber-100">Export your history archive and store it in a long-term folder outside the app for recall later.</p>
          <div className="flex flex-wrap gap-2">
            <button className="min-h-[44px] rounded-lg bg-safety px-3 py-2 text-sm font-bold text-black" onClick={onExportHistoryArchive} type="button">
              Export History Archive
            </button>
            <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
              Import Archive
              <input accept=".json,application/json" className="hidden" onChange={(event) => void onImportHistoryArchive(event)} type="file" />
            </label>
          </div>
        </section>
      ) : null}

      <section className="space-y-2 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-sm font-semibold text-safety">Recent Handover Exports ({history.length}/7)</h3>
        {history.length === 0 ? <p className="text-xs text-slate-300">No export history yet.</p> : null}
        <ul className="space-y-1 text-xs text-slate-200">
          {history.map((entry) => (
            <li className="rounded-lg border border-slate-600 bg-slate-900 p-2" key={entry.id}>
              {new Date(entry.exportedAt).toLocaleString()} • {entry.role.toUpperCase()} • {entry.format.toUpperCase()} • {entry.unitArea || '-'} • {entry.shiftWindow || '-'}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function TextField(props: { label: string; value: string; onChange: (value: string) => void }): JSX.Element {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{props.label}</span>
      <input
        className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900"
        onChange={(event) => props.onChange(event.currentTarget.value)}
        type="text"
        value={props.value}
      />
    </label>
  );
}

function TextAreaField(props: { label: string; value: string; onChange: (value: string) => void }): JSX.Element {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{props.label}</span>
      <textarea
        className="mt-2 min-h-[88px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900"
        onChange={(event) => props.onChange(event.currentTarget.value)}
        value={props.value}
      />
    </label>
  );
}
