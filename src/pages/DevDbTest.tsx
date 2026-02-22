import { useEffect, useState } from 'react';
import { getTableCounts, seedTestData } from '../db';

interface Counts {
  tags: number;
  jobs: number;
  steps: number;
  evidence: number;
  signatures: number;
}

const ZERO_COUNTS: Counts = {
  tags: 0,
  jobs: 0,
  steps: 0,
  evidence: 0,
  signatures: 0
};

export function DevDbTest(): JSX.Element {
  const [counts, setCounts] = useState<Counts>(ZERO_COUNTS);
  const [status, setStatus] = useState<string>('Loading counts...');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    void refreshCounts(mounted);
    return () => {
      mounted = false;
    };
  }, []);

  const refreshCounts = async (mounted = true): Promise<void> => {
    try {
      const current = await getTableCounts();
      if (!mounted) {
        return;
      }
      setCounts(current);
      setStatus('Counts loaded from IndexedDB.');
      setError('');
    } catch (loadError) {
      if (!mounted) {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Failed to load counts.');
    }
  };

  const handleSeed = async (): Promise<void> => {
    try {
      await seedTestData();
      await refreshCounts();
      setStatus('Seeded 1 tag, 1 job, 5 steps.');
      setError('');
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : 'Failed to seed data.');
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-safety">DB Test (Dev)</h2>
      <p className="text-sm text-slate-300">Use this page to confirm IndexedDB persistence across refreshes.</p>
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm">
        <p>Status: {status}</p>
        {error ? <p className="mt-2 text-red-400">Error: {error}</p> : null}
      </div>
      <button className="min-h-16 rounded-xl bg-safety px-4 py-4 text-base font-bold text-black" onClick={() => void handleSeed()} type="button">
        Seed Test Data
      </button>
      <ul className="space-y-2 rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm">
        <li>tags: {counts.tags}</li>
        <li>jobs: {counts.jobs}</li>
        <li>steps: {counts.steps}</li>
        <li>evidence: {counts.evidence}</li>
        <li>signatures: {counts.signatures}</li>
      </ul>
    </section>
  );
}
