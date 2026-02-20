import { useEffect, useState } from 'react';
import { getTableCounts } from '../db';
import { exportBackupZip, importBackupZip } from '../utils/backup';

interface StorageEstimate {
  quota: number;
  usage: number;
  remaining: number;
}

export function Diagnostics(): JSX.Element {
  const [persistStatus, setPersistStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [counts, setCounts] = useState<{ tags: number; jobs: number; photos: number }>({ tags: 0, jobs: 0, photos: 0 });
  const [estimate, setEstimate] = useState<StorageEstimate>({ quota: 0, usage: 0, remaining: 0 });
  const [status, setStatus] = useState<string>('Loading diagnostics...');
  const [error, setError] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  useEffect(() => {
    void loadDiagnostics();
  }, []);

  const loadDiagnostics = async (): Promise<void> => {
    try {
      const persisted = await requestStoragePersistence();
      setPersistStatus(persisted ? 'granted' : 'denied');

      const countsData = await getTableCounts();
      setCounts({ tags: countsData.tags, jobs: countsData.jobs, photos: countsData.evidence });

      const usageInfo = await getStorageEstimate();
      setEstimate(usageInfo);

      setStatus('Diagnostics loaded.');
      setError('');
    } catch (diagnosticError) {
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

  const onSelectImport = (event: { target: HTMLInputElement }): void => {
    const selected = event.target.files?.[0];
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

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Diagnostics</h2>
      <p className="text-sm text-slate-300">Storage persistence, quota, and backup controls.</p>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm">
        <p>Status: {status}</p>
        {error ? <p className="mt-2 text-red-400">Error: {error}</p> : null}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm">
        <p>Persistence: {persistStatus === 'granted' ? 'Granted' : persistStatus === 'denied' ? 'Denied' : 'Unknown'}</p>
        <p>Tags Stored: {counts.tags}</p>
        <p>Jobs Stored: {counts.jobs}</p>
        <p>Photos Stored: {counts.photos}</p>
        <p>Used Space: {formatBytes(estimate.usage)}</p>
        <p>Remaining Space: {formatBytes(estimate.remaining)}</p>
      </div>

      <button className="min-h-14 w-full rounded-xl bg-safety px-4 py-3 text-base font-bold text-black" onClick={() => void onExport()} type="button">
        Export Backup (ZIP)
      </button>

      <label className="block rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-center text-base font-bold text-white">
        Import Backup
        <input accept=".zip,application/zip" className="hidden" onChange={onSelectImport} type="file" />
      </label>

      {showConfirm ? (
        <div className="rounded-xl border border-amber-400 bg-amber-950/40 p-4">
          <p className="text-sm text-amber-200">Confirm Overwrite: importing backup will replace all local data.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="min-h-12 rounded-lg bg-slate-700" onClick={() => setShowConfirm(false)} type="button">
              Cancel
            </button>
            <button className="min-h-12 rounded-lg bg-safety font-bold text-black" onClick={() => void onConfirmImport()} type="button">
              Confirm Overwrite
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
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
