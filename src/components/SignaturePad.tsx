import { useEffect, useRef, useState } from 'react';

interface SignaturePadProps {
  jobId: number;
  initialTechName: string;
  onSave: (jobId: number, signedBy: string, file: Blob) => Promise<void>;
}

export function SignaturePad({ jobId, initialTechName, onSave }: SignaturePadProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<boolean>(false);
  const hasInkRef = useRef<boolean>(false);
  const [techName, setTechName] = useState<string>(initialTechName);
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    setTechName(initialTechName);
  }, [initialTechName]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.scale(pixelRatio, pixelRatio);
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.strokeStyle = '#111111';
  }, []);

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) {
      return;
    }
    const point = getCanvasPoint(event);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
    hasInkRef.current = true;
    setError('');
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!drawingRef.current) {
      return;
    }
    const context = canvasRef.current?.getContext('2d');
    if (!context) {
      return;
    }
    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const onPointerUp = (): void => {
    drawingRef.current = false;
  };

  const onClear = (): void => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasInkRef.current = false;
    setError('');
  };

  const onSaveClick = async (): Promise<void> => {
    if (isSaving) {
      return;
    }
    try {
      const canvas = canvasRef.current;
      if (!canvas || !hasInkRef.current) {
        setError('Please provide a signature before saving.');
        return;
      }
      if (!Number.isFinite(jobId) || jobId <= 0) {
        setError('Job is not ready for signature save. Please reload this job.');
        return;
      }
      if (techName.trim().length === 0) {
        setError('Technician name is required for sign-off.');
        return;
      }

      setIsSaving(true);
      const blob = await toBlob(canvas);
      await onSave(jobId, techName.trim(), blob);
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      hasInkRef.current = false;
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save signature.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
      <h3 className="text-lg font-semibold">Job Sign-off</h3>
      <label className="block">
        <span className="text-sm text-slate-300">Technician Name</span>
        <input
          className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base"
          onChange={(event) => setTechName(event.currentTarget.value)}
          value={techName}
        />
      </label>
      <div className="rounded-lg bg-white p-2">
        <canvas
          className="h-40 w-full touch-none rounded-lg border border-slate-300"
          onPointerDown={onPointerDown}
          onPointerLeave={onPointerUp}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          ref={canvasRef}
        />
      </div>
      {error ? <p className="rounded-lg border border-red-500 bg-red-950 p-2 text-sm">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <button className="min-h-[44px] rounded-lg bg-slate-100 p-3 font-bold text-slate-900" onClick={onClear} type="button">
          Clear
        </button>
        <button className="min-h-[44px] rounded-lg bg-safety p-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-70" disabled={isSaving} onClick={() => void onSaveClick()} type="button">
          {isSaving ? 'Saving...' : '✓ Save'}
        </button>
      </div>
    </section>
  );
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const fallbackBlob = dataUrlToBlob(dataUrl);
          resolve(fallbackBlob);
          return;
        } catch {
          reject(new Error('Failed to save signature image.'));
          return;
        }
      }
      resolve(blob);
    }, 'image/png');
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mimeMatch = header?.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] ?? 'image/png';
  const binary = atob(data ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}
