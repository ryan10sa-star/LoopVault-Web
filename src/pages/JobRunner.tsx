import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SignaturePad } from '../components/SignaturePad';
import {
  completeJob,
  getJobRunnerData,
  getSignatureByJob,
  listEvidenceByJob,
  saveSignature,
  updateJobTechName,
  updateStep,
  type StepEntity
} from '../db';
import { generateLoopFolderPdf } from '../utils/pdfGenerator';

export function JobRunner(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const jobId = Number(params.jobId ?? '0');

  const data = useLiveQuery(async () => {
    if (!Number.isFinite(jobId) || jobId <= 0) {
      return null;
    }
    return await getJobRunnerData(jobId);
  }, [jobId], null);

  const canComplete = useMemo(() => {
    if (!data) {
      return false;
    }
    return data.steps.every((step) => stepHasEntry(step));
  }, [data]);

  const onPassFailChange = async (stepId: number, value: 'pass' | 'fail'): Promise<void> => {
    await updateStep(stepId, { passFail: value });
  };

  const onNumberChange = async (stepId: number, rawValue: string): Promise<void> => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      await updateStep(stepId, { valueNumber: undefined });
      return;
    }
    await updateStep(stepId, { valueNumber: parsed });
  };

  const onTextChange = async (stepId: number, value: string): Promise<void> => {
    await updateStep(stepId, { valueText: value });
  };

  const onCompleteJob = async (): Promise<void> => {
    if (!data) {
      setError('Job not found.');
      return;
    }
    if (!canComplete) {
      setError('Complete all steps before finishing the job.');
      return;
    }
    await completeJob(data.job.id as number);
    setStatusMessage('Job marked as completed.');
    setError('');
  };

  const onSaveSignature = async (currentJobId: number, signedBy: string, file: Blob): Promise<void> => {
    await saveSignature(currentJobId, signedBy, file);
    await updateJobTechName(currentJobId, signedBy);
    setStatusMessage('Signature saved for job sign-off.');
    setError('');
  };

  const onGeneratePdf = async (): Promise<void> => {
    if (!data) {
      setError('Job data unavailable for PDF export.');
      return;
    }
    try {
      const signature = await getSignatureByJob(data.job.id as number);
      if (!signature) {
        setError('Please save a signature before generating the loop folder PDF.');
        return;
      }
      const evidence = await listEvidenceByJob(data.job.id as number);
      await generateLoopFolderPdf({
        job: data.job,
        tag: data.tag,
        steps: data.steps,
        evidence,
        signature
      });
      setStatusMessage('Loop folder PDF generated.');
      setError('');
    } catch (pdfError) {
      setError(pdfError instanceof Error ? `PDF export failed: ${pdfError.message}` : 'PDF export failed.');
    }
  };

  if (!data) {
    return <p className="rounded-lg border border-red-500 bg-red-950 p-3 text-sm">Job not found.</p>;
  }

  return (
    <section className="space-y-4">
      <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm" onClick={() => navigate(`/tags/${encodeURIComponent(data.tag.tagNumber)}`)} type="button">
        Back to Tag
      </button>

      <header className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h2 className="text-xl font-bold text-safety">{data.tag.tagNumber}</h2>
        <p className="text-sm text-slate-200">Job Type: {data.job.jobType}</p>
        <p className="text-sm text-slate-200">Status: {data.job.status === 'completed' ? 'Complete' : 'In-Progress'}</p>
      </header>

      {statusMessage ? <p className="rounded-lg border border-emerald-500 bg-emerald-950 p-3 text-sm">{statusMessage}</p> : null}
      {error ? <p className="rounded-lg border border-red-500 bg-red-950 p-3 text-sm">{error}</p> : null}

      <div className="space-y-3">
        {data.steps.map((step) => (
          <article className="rounded-xl border border-slate-700 bg-slate-800 p-4" key={step.id}>
            <h3 className="text-lg font-semibold">{step.title}</h3>
            {step.inputType === 'passfail' ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className={`min-h-14 rounded-lg px-3 py-2 text-lg font-bold ${step.passFail === 'pass' ? 'bg-emerald-500 text-black' : 'bg-slate-700 text-white'}`}
                  onClick={() => void onPassFailChange(step.id as number, 'pass')}
                  type="button"
                >
                  Pass
                </button>
                <button
                  className={`min-h-14 rounded-lg px-3 py-2 text-lg font-bold ${step.passFail === 'fail' ? 'bg-red-500 text-black' : 'bg-slate-700 text-white'}`}
                  onClick={() => void onPassFailChange(step.id as number, 'fail')}
                  type="button"
                >
                  Fail
                </button>
              </div>
            ) : null}

            {step.inputType === 'number' ? (
              <label className="mt-3 block">
                <span className="text-sm text-slate-300">Measurement ({step.unit ?? 'value'})</span>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-lg"
                  inputMode="decimal"
                  onInput={(event: { target: HTMLInputElement }) => void onNumberChange(step.id as number, event.target.value)}
                  type="number"
                  value={typeof step.valueNumber === 'number' ? String(step.valueNumber) : ''}
                />
              </label>
            ) : null}

            {step.inputType === 'text' ? (
              <label className="mt-3 block">
                <span className="text-sm text-slate-300">Notes</span>
                <textarea
                  className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base"
                  onInput={(event: { target: HTMLTextAreaElement }) => void onTextChange(step.id as number, event.target.value)}
                  value={step.valueText}
                />
              </label>
            ) : null}
          </article>
        ))}
      </div>

      <button
        className={`min-h-16 w-full rounded-xl px-4 py-4 text-lg font-bold ${canComplete ? 'bg-safety text-black' : 'bg-slate-600 text-slate-300'}`}
        onClick={() => void onCompleteJob()}
        type="button"
      >
        Complete Job
      </button>
      {!canComplete ? <p className="text-sm text-amber-300">Fill every step before completing the job.</p> : null}

      <SignaturePad initialTechName={data.job.techName} jobId={data.job.id as number} onSave={onSaveSignature} />

      {data.job.status === 'completed' ? (
        <button className="min-h-16 w-full rounded-xl bg-safety px-4 py-4 text-lg font-bold text-black" onClick={() => void onGeneratePdf()} type="button">
          Generate Loop Folder
        </button>
      ) : null}
    </section>
  );
}

function stepHasEntry(step: StepEntity): boolean {
  if (step.inputType === 'passfail') {
    return step.passFail === 'pass' || step.passFail === 'fail';
  }
  if (step.inputType === 'number') {
    return typeof step.valueNumber === 'number' && Number.isFinite(step.valueNumber);
  }
  return step.valueText.trim().length > 0;
}
