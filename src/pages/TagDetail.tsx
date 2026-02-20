import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TagQRCode } from '../components/TagQRCode';
import { createJobFromTemplate, db, getJobsByTag, type JobEntity, type TagEntity } from '../db';
import { loadTemplate } from '../templates';

export function TagDetail(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showNewJobModal, setShowNewJobModal] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  const rawTagNumber = params.tagNumber ?? '';
  const tagNumber = decodeURIComponent(rawTagNumber);

  const tag = useLiveQuery(async () => {
    const matches = await db.tags.where('tagNumber').equals(tagNumber).toArray();
    return matches[0];
  }, [tagNumber], undefined) as TagEntity | undefined;

  const jobHistory = useLiveQuery(async () => {
    if (!tag || typeof tag.id !== 'number') {
      return [] as JobEntity[];
    }
    return await getJobsByTag(tag.id);
  }, [tag?.id], []) as JobEntity[];

  const onCreateJob = async (jobType: JobEntity['jobType']): Promise<void> => {
    if (!tag || typeof tag.id !== 'number') {
      setError('Tag record is unavailable.');
      return;
    }
    try {
      const template = await loadTemplate(jobType);
      const jobId = await createJobFromTemplate(tag.id, jobType, template.steps);
      setStatus(`Created ${jobType} job #${jobId}.`);
      setError('');
      setShowNewJobModal(false);
      navigate(`/jobs/${jobId}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create job.');
    }
  };

  return (
    <section className="space-y-4">
      <button
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm"
        onClick={() => navigate(`/tags${searchParams.toString() ? `?${searchParams.toString()}` : ''}`)}
        type="button"
      >
        Back to Tags
      </button>

      {!tag ? <p className="rounded-lg border border-red-500 bg-red-950 p-3 text-sm">Tag not found.</p> : null}

      {tag ? (
        <>
          <h2 className="text-2xl font-bold text-safety">{tag.tagNumber}</h2>
          <div className="grid gap-3 rounded-xl border border-slate-700 bg-slate-800 p-4 text-lg">
            <MetadataRow label="Description" value={tag.description} />
            <MetadataRow label="Area" value={tag.area} />
            <MetadataRow label="Unit" value={tag.unit} />
            <MetadataRow label="Service" value={tag.service} />
          </div>

          <TagQRCode tagNumber={tag.tagNumber} />

          {status ? <p className="rounded-lg border border-emerald-500 bg-emerald-950 p-3 text-sm">{status}</p> : null}
          {error ? <p className="rounded-lg border border-red-500 bg-red-950 p-3 text-sm">{error}</p> : null}

          <div className="grid gap-3">
            <button
              className="min-h-16 rounded-xl bg-safety px-4 py-4 text-lg font-bold text-black"
              onClick={() => setShowNewJobModal(true)}
              type="button"
            >
              New Job
            </button>
            <button
              className="min-h-16 rounded-xl border border-slate-600 bg-slate-700 px-4 py-4 text-lg font-bold text-white"
              onClick={() => setShowHistory((prev) => !prev)}
              type="button"
            >
              History
            </button>
          </div>

          {showHistory ? (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm">
              {jobHistory.length === 0 ? <p>No job history yet.</p> : <ul className="space-y-2">{jobHistory.map((job) => <li key={job.id}>#{job.id} • {job.jobType} • {job.status} • {job.techName}</li>)}</ul>}
            </div>
          ) : null}

          {showNewJobModal ? (
            <div className="rounded-xl border border-slate-500 bg-slate-900 p-4">
              <h3 className="mb-3 text-lg font-semibold">Create Job</h3>
              <div className="grid gap-2">
                <button className="min-h-14 rounded-lg bg-safety px-3 py-2 font-bold text-black" onClick={() => void onCreateJob('loop-check')} type="button">
                  Loop Check
                </button>
                <button className="min-h-14 rounded-lg bg-safety px-3 py-2 font-bold text-black" onClick={() => void onCreateJob('calibration')} type="button">
                  Calibration
                </button>
                <button className="min-h-12 rounded-lg bg-slate-700 px-3 py-2" onClick={() => setShowNewJobModal(false)} type="button">
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <Link className="text-safety underline" to="/tags">
          Go to Tags
        </Link>
      )}
    </section>
  );
}

function MetadataRow(props: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-600 p-3">
      <p className="text-sm uppercase tracking-wide text-slate-300">{props.label}</p>
      <p className="text-lg font-semibold text-white">{props.value}</p>
    </div>
  );
}
