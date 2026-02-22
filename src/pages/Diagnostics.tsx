import { useEffect, useState } from 'react';
import { loadSitePreferences } from '../config/sitePreferences';
import { getTableCounts, purgeAllData, repairJobRecords } from '../db';
import { exportBackupZip, importBackupZip } from '../utils/backup';

interface StorageEstimate {
  quota: number;
  usage: number;
  remaining: number;
}

export function Diagnostics(): JSX.Element {
  const [persistStatus, setPersistStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [counts, setCounts] = useState<{ tags: number; jobs: number; photos: number; documents: number }>({ tags: 0, jobs: 0, photos: 0, documents: 0 });
  const [estimate, setEstimate] = useState<StorageEstimate>({ quota: 0, usage: 0, remaining: 0 });
  const [status, setStatus] = useState<string>('Loading diagnostics...');
  const [error, setError] = useState<string>('');
  const [isRepairing, setIsRepairing] = useState<boolean>(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [showPurgeLayer1, setShowPurgeLayer1] = useState<boolean>(false);
  const [showPurgeLayer2, setShowPurgeLayer2] = useState<boolean>(false);
  const [purgePhrase, setPurgePhrase] = useState<string>('');
  const [purgeReason, setPurgeReason] = useState<string>('');
  const [activeRole, setActiveRole] = useState<'tech' | 'lead' | 'admin'>('tech');
  const lastRuntimeError = typeof window !== 'undefined' ? window.localStorage.getItem('loopvault:lastRuntimeError') : null;

  useEffect(() => {
    let mounted = true;
    const prefs = loadSitePreferences();
    setActiveRole(prefs.activeUserRole);
    void loadDiagnostics(mounted);
    return () => {
      mounted = false;
    };
  }, []);

  const loadDiagnostics = async (mounted = true, preserveStatus = false): Promise<void> => {
    try {
      const persisted = await requestStoragePersistence();
      if (!mounted) {
        return;
      }
      setPersistStatus(persisted ? 'granted' : 'denied');

      const countsData = await getTableCounts();
      if (!mounted) {
        return;
      }
      setCounts({ tags: countsData.tags, jobs: countsData.jobs, photos: countsData.evidence, documents: countsData.documents });

      const usageInfo = await getStorageEstimate();
      if (!mounted) {
        return;
      }
      setEstimate(usageInfo);

      if (!preserveStatus) {
        setStatus('Diagnostics loaded.');
      }
      setError('');
    } catch (diagnosticError) {
      if (!mounted) {
        return;
      }
      setError(diagnosticError instanceof Error ? diagnosticError.message : 'Failed to load diagnostics.');
    }
  };

  const onExport = async (): Promise<void> => {
    try {
      await exportBackupZip();
      setStatus('Backup export started.');
      setError('');
    } catch (exportError) {
      setError(exportError instanceof Error ? `Export failed: ${exportError.message}` : 'Export failed.');
    }
  };

  const onSelectImport = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const selected = event.currentTarget.files?.[0];
    if (!selected) {
      return;
    }
    setPendingFile(selected);
    setShowConfirm(true);
  };

  const onConfirmImport = async (): Promise<void> => {
    if (!pendingFile) {
      return;
    }
    try {
      await importBackupZip(pendingFile);
      setStatus('Backup imported and local data restored.');
      setError('');
      setPendingFile(null);
      setShowConfirm(false);
      await loadDiagnostics();
    } catch (importError) {
      setError(importError instanceof Error ? `Import failed: ${importError.message}` : 'Import failed.');
    }
  };

  const onRepairRecords = async (): Promise<void> => {
    setIsRepairing(true);
    setStatus('Running repair on local job records...');
    try {
      const result = await repairJobRecords();
      setStatus(`Repair complete. Jobs repaired: ${result.repairedJobs}. Steps repaired: ${result.repairedSteps}.`);
      setError('');
      await loadDiagnostics(true, true);
    } catch (repairError) {
      setError(repairError instanceof Error ? `Repair failed: ${repairError.message}` : 'Repair failed.');
    } finally {
      setIsRepairing(false);
    }
  };

  const onPurgeAll = async (): Promise<void> => {
    if (activeRole !== 'admin') {
      setError('Only Admin can execute global purge.');
      return;
    }
    if (purgePhrase.trim() !== 'PURGE ALL DATA') {
      setError('Type PURGE ALL DATA to confirm global purge.');
      return;
    }
    if (countWords(purgeReason) < 5) {
      setError('Purge reason must be at least 5 words.');
      return;
    }
    try {
      await purgeAllData('local-user', purgeReason);
      setStatus('Global purge complete. Database reset to empty state.');
      setError('');
      setShowPurgeLayer1(false);
      setShowPurgeLayer2(false);
      setPurgePhrase('');
      setPurgeReason('');
      await loadDiagnostics(true, true);
    } catch (purgeErr) {
      setError(purgeErr instanceof Error ? `Purge failed: ${purgeErr.message}` : 'Purge failed.');
    }
  };

  const onCancelPurgeFlow = (): void => {
    setShowPurgeLayer2(false);
    setShowPurgeLayer1(false);
    setPurgePhrase('');
    setPurgeReason('');
    setError('');
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Diagnostics</h2>
      <p className="text-sm text-slate-300">Storage persistence, quota, and backup controls.</p>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm">
        <p>Status: {status}</p>
        {error ? <p className="mt-2 text-red-400">Error: {error}</p> : null}
      </div>

      {lastRuntimeError ? (
        <div className="rounded-lg border border-amber-500 bg-amber-950/40 p-4 text-sm">
          <p className="font-semibold text-amber-200">Last Runtime Error</p>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-amber-100">{lastRuntimeError}</pre>
          <button
            className="mt-3 min-h-[40px] rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900"
            onClick={() => {
              window.localStorage.removeItem('loopvault:lastRuntimeError');
              setStatus('Cleared stored runtime error.');
            }}
            type="button"
          >
            Clear Stored Error
          </button>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm">
        <p>Persistence: {persistStatus === 'granted' ? 'Granted' : persistStatus === 'denied' ? 'Denied' : 'Unknown'}</p>
        <p>Tags Stored: {counts.tags}</p>
        <p>Jobs Stored: {counts.jobs}</p>
        <p>Photos Stored: {counts.photos}</p>
        <p>Documents Stored: {counts.documents}</p>
        <p>Used Space: {formatBytes(estimate.usage)}</p>
        <p>Remaining Space: {formatBytes(estimate.remaining)}</p>
      </div>

      <button className="min-h-14 w-full rounded-xl bg-safety px-4 py-3 text-base font-bold text-black" onClick={() => void onExport()} type="button">
        ✓ Export Backup (ZIP)
      </button>

      <button
        className="min-h-14 w-full rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-base font-bold text-amber-900 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isRepairing}
        onClick={() => void onRepairRecords()}
        type="button"
      >
        {isRepairing ? 'Repairing Job Records...' : 'Repair Job Records'}
      </button>

      <label className="block min-h-[44px] rounded-xl border border-slate-400 bg-slate-100 px-4 py-3 text-center text-base font-bold text-slate-900">
        Import Backup
        <input accept=".zip,application/zip" className="hidden" onChange={onSelectImport} type="file" />
      </label>

      {showConfirm ? (
        <div className="rounded-xl border border-amber-400 bg-amber-950/40 p-4">
          <p className="text-sm text-amber-200">Confirm Overwrite: importing backup will replace all local data.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="min-h-[44px] rounded-lg bg-slate-100 font-semibold text-slate-900" onClick={() => setShowConfirm(false)} type="button">
              Cancel
            </button>
            <button className="min-h-[44px] rounded-lg bg-safety font-bold text-black" onClick={() => void onConfirmImport()} type="button">
              Confirm Overwrite
            </button>
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-red-500 bg-red-950/20 p-4">
        <h3 className="text-base font-semibold text-red-200">Danger Zone</h3>
        <p className="mt-1 text-xs text-red-100">Use only when intentionally resetting this device for a new site/start-over state.</p>
        {activeRole !== 'admin' ? <p className="mt-2 text-xs text-amber-100">Admin role required. Current role: {activeRole.toUpperCase()}.</p> : null}
        {!showPurgeLayer1 ? (
          <button className="mt-3 min-h-[44px] rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60" disabled={activeRole !== 'admin'} onClick={() => setShowPurgeLayer1(true)} type="button">
            Begin Global Purge
          </button>
        ) : (
          <div className="mt-3 space-y-2 rounded-lg border border-red-500 bg-red-950/40 p-3">
            <p className="text-xs text-red-100">Layer 1 Warning: this permanently deletes tags, jobs, photos, signatures, documents, and history.</p>
            {!showPurgeLayer2 ? (
              <div className="grid grid-cols-2 gap-2">
                <button className="min-h-[44px] rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900" onClick={onCancelPurgeFlow} type="button">
                  Cancel
                </button>
                <button className="min-h-[44px] rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-black" onClick={() => setShowPurgeLayer2(true)} type="button">
                  Continue to Final Purge
                </button>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-red-500 bg-red-950/50 p-3">
                <p className="text-xs text-red-100">Layer 2 Final Confirmation</p>
                <label className="block text-xs text-red-100">
                  Type exact phrase: PURGE ALL DATA
                  <input className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-white" onChange={(event) => setPurgePhrase(event.currentTarget.value)} type="text" value={purgePhrase} />
                </label>
                <label className="block text-xs text-red-100">
                  Reason (minimum 5 words)
                  <textarea className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-white" onChange={(event) => setPurgeReason(event.currentTarget.value)} value={purgeReason} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button className="min-h-[44px] rounded-lg bg-slate-100 text-sm font-semibold text-slate-900" onClick={onCancelPurgeFlow} type="button">
                    Cancel
                  </button>
                  <button className="min-h-[44px] rounded-lg bg-red-500 text-sm font-bold text-black" onClick={() => void onPurgeAll()} type="button">
                    Confirm Global Purge
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </section>
  );
}

function countWords(input: string): number {
  return input
    .trim()
    .split(/\s+/)
    .filter((segment) => segment.length > 0).length;
}

async function requestStoragePersistence(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) {
    return false;
  }
  return await navigator.storage.persist();
}

async function getStorageEstimate(): Promise<StorageEstimate> {
  if (!navigator.storage || !navigator.storage.estimate) {
    return { quota: 0, usage: 0, remaining: 0 };
  }
  const result = await navigator.storage.estimate();
  const quota = typeof result.quota === 'number' ? result.quota : 0;
  const usage = typeof result.usage === 'number' ? result.usage : 0;
  return {
    quota,
    usage,
    remaining: Math.max(0, quota - usage)
  };
}

function formatBytes(input: number): string {
  if (input <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = input;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
