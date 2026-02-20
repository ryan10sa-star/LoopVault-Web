import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  jobId: number;
  initialTechName: string;
  onSave: (jobId: number, signedBy: string, file: Blob) => Promise<void>;
}

export function SignaturePad({ jobId, initialTechName, onSave }: SignaturePadProps): JSX.Element {
  const canvasRef = useRef<SignatureCanvas | null>(null);
  const [techName, setTechName] = useState<string>(initialTechName);
  const [error, setError] = useState<string>('');

  const onClear = (): void => {
    canvasRef.current?.clear();
    setError('');
  };

  const onSaveClick = async (): Promise<void> => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.isEmpty()) {
      setError('Please provide a signature before saving.');
      return;
    }
    if (techName.trim().length === 0) {
      setError('Technician name is required for sign-off.');
      return;
    }

    const trimmed = canvas.getTrimmedCanvas();
    const blob = await toBlob(trimmed);
    await onSave(jobId, techName.trim(), blob);
    setError('');
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
      <h3 className="text-lg font-semibold">Job Sign-off</h3>
      <label className="block">
        <span className="text-sm text-slate-300">Technician Name</span>
        <input
          className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base"
          onInput={(event: { target: HTMLInputElement }) => setTechName(event.target.value)}
          value={techName}
        />
      </label>
      <div className="rounded-lg bg-white p-2">
        <SignatureCanvas
          canvasProps={{ className: 'h-40 w-full border border-slate-300 rounded-lg' }}
          penColor="black"
          ref={canvasRef}
        />
      </div>
      {error ? <p className="rounded-lg border border-red-500 bg-red-950 p-2 text-sm">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <button className="min-h-12 rounded-lg bg-slate-700 font-bold" onClick={onClear} type="button">
          Clear
        </button>
        <button className="min-h-12 rounded-lg bg-safety font-bold text-black" onClick={() => void onSaveClick()} type="button">
          Save
        </button>
      </div>
    </section>
  );
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to save signature image.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}
