import { Database, QrCode, Tags } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { upsertTagsBulk, type TagEntity } from '../db';

export function Home(): JSX.Element {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  const onImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const onCsvSelected = async (event: { target: HTMLInputElement }): Promise<void> => {
    const file = event.target.files?.[0];
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

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Field Dashboard</h2>
      <p className="text-sm text-slate-300">Offline-first scaffold with industrial dark mode and large touch targets.</p>
      {status ? <p className="rounded-lg border border-emerald-500 bg-emerald-950 p-3 text-sm">{status}</p> : null}
      {error ? <p className="rounded-lg border border-red-500 bg-red-950 p-3 text-sm">{error}</p> : null}
      <div className="grid gap-3">
        <button className="flex min-h-16 items-center justify-center gap-2 rounded-xl bg-safety px-4 py-4 text-lg font-bold text-black" onClick={onImportClick} type="button">
          <Database size={22} /> Import Tags
        </button>
        <input accept=".csv,text/csv" className="hidden" onChange={(event: { target: HTMLInputElement }) => void onCsvSelected(event)} ref={fileInputRef} type="file" />

        <Link className="flex min-h-16 items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-4 text-lg font-bold text-white" to="/scanner">
          <QrCode size={22} /> Scan QR
        </Link>

        <Link className="flex min-h-16 items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-4 text-lg font-bold text-white" to="/tags">
          <Tags size={22} /> Tags
        </Link>
      </div>

      <a className="text-sm text-safety underline" href="/sample-tags.csv">
        Download sample tags CSV
      </a>
    </section>
  );
}

function parseTagsCsv(content: string): TagEntity[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rows = lines.map((line) => line.split(',').map((cell) => cell.trim()));
  return rows
    .filter((row) => row.length >= 5)
    .map((row) => {
      const [tagNumber, description, area, unit, service] = row;
      if (!tagNumber || !description || !area || !unit || !service) {
        throw new Error('Each row must include tagNumber, description, area, unit, service.');
      }
      return {
        tagNumber,
        description,
        area,
        unit,
        service
      };
    });
}
