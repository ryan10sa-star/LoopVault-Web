import { BrowserMultiFormatReader } from '@zxing/library';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getTagByNumber } from '../db';

export function Scanner(): JSX.Element {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const didHandleScanRef = useRef<boolean>(false);
  const [status, setStatus] = useState<string>('Starting camera...');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    didHandleScanRef.current = false;

    void reader
      .decodeFromVideoDevice(undefined, videoRef.current, async (result, decodeError) => {
        if (decodeError || !result || didHandleScanRef.current) {
          return;
        }

        try {
          didHandleScanRef.current = true;
          const rawText = result.getText();
          const parsed = parseTagPayload(rawText);
          const existing = await getTagByNumber(parsed);

          if (!mounted) {
            return;
          }
          stopScanner();
          if (existing) {
            navigate(`/tags/${encodeURIComponent(parsed)}`);
            return;
          }
          navigate(`/tags/new?tagNumber=${encodeURIComponent(parsed)}`);
        } catch (scanError) {
          if (!mounted) {
            return;
          }
          setError(scanError instanceof Error ? scanError.message : 'Failed to process scanned tag.');
          didHandleScanRef.current = false;
        }
      })
      .then(() => {
        if (!mounted) {
          return;
        }
        setStatus('Camera active. Aim the QR inside the target box.');
        setError('');
      })
      .catch((cameraError: Error) => {
        if (!mounted) {
          return;
        }
        if (cameraError.name === 'NotAllowedError') {
          setError('Camera access denied. Please allow camera permission and try again.');
        } else {
          setError(`Unable to start scanner: ${cameraError.message}`);
        }
      });

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [navigate]);

  const stopScanner = (): void => {
    readerRef.current?.reset();
    const videoElement = videoRef.current;
    const stream = videoElement?.srcObject;
    if (stream && stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
    }
  };

  const onCancel = (): void => {
    stopScanner();
    navigate('/');
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">QR Scanner</h2>
      <p className="text-sm text-slate-300">Scan a LoopVault tag QR to open details instantly.</p>
      <div className="relative overflow-hidden rounded-xl border border-slate-600 bg-black">
        <video className="aspect-[3/4] w-full object-cover" ref={videoRef} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-56 w-56 rounded-xl border-2 border-safety">
            <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-red-500" />
          </div>
        </div>
      </div>
      <p className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm">{status}</p>
      {error ? <p className="rounded-lg border border-red-500 bg-red-950 p-3 text-sm">{error}</p> : null}
      <Link className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-100 px-4 py-3 text-base font-bold text-slate-900" to="/help">
        Help & Docs
      </Link>
      <button className="min-h-[44px] w-full rounded-xl bg-slate-100 px-4 py-3 text-base font-bold text-slate-900" onClick={onCancel} type="button">
        Close / Cancel
      </button>
    </section>
  );
}

function parseTagPayload(rawText: string): string {
  const prefix = 'loopvault:tag:';
  if (rawText.startsWith(prefix)) {
    return rawText.slice(prefix.length).trim();
  }
  return rawText.trim();
}
