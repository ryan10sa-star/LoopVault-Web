import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { StatusChip } from '../components/StatusChip';
import { TagQRCode } from '../components/TagQRCode';
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES, MAX_DOCUMENT_BYTES_GLOBAL, MAX_DOCUMENT_BYTES_PER_TAG, MAX_DOCUMENTS_PER_TAG } from '../config/appLimits';
import { loadSitePreferences } from '../config/sitePreferences';
import { addTagDocument, createJobFromTemplate, db, deleteTagDocument, deleteTagWithCascade, getDocumentUsage, getJobsByTag, listTagDocuments, updateTag, type JobEntity, type StepEntity, type TagDocumentEntity, type TagEntity } from '../db';
import { loadTemplate } from '../templates';

export function TagDetail(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showNewJobModal, setShowNewJobModal] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState<boolean>(false);
  const [metadataDraft, setMetadataDraft] = useState<Pick<TagEntity, 'instrumentRole' | 'safetyLayer' | 'votingLogic' | 'controlSystem' | 'silTarget' | 'proofTestInterval' | 'bypassPermitRequired' | 'functionalOwner'>>({
    instrumentRole: '',
    safetyLayer: '',
    votingLogic: '',
    controlSystem: '',
    silTarget: '',
    proofTestInterval: '',
    bypassPermitRequired: '',
    functionalOwner: ''
  });
  const [metadataError, setMetadataError] = useState<string>('');
  const [selectedDocType, setSelectedDocType] = useState<string>('loop-sheet');
  const [documentFilter, setDocumentFilter] = useState<string>('all');
  const [uploadedBy, setUploadedBy] = useState<string>('Tech');
  const [showDeleteLayer1, setShowDeleteLayer1] = useState<boolean>(false);
  const [showDeleteLayer2, setShowDeleteLayer2] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<'tech' | 'lead' | 'admin'>('tech');
  const [deleteReasonTemplate, setDeleteReasonTemplate] = useState<string>('');
  const [deleteConfirmTag, setDeleteConfirmTag] = useState<string>('');
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [deleteSigner, setDeleteSigner] = useState<string>('');
  const [deleteSignatureBlob, setDeleteSignatureBlob] = useState<Blob | null>(null);
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

  const sortedJobs = useMemo(() => {
    return [...jobHistory].sort((left, right) => (right.id ?? 0) - (left.id ?? 0));
  }, [jobHistory]);

  const jobIdsKey = useMemo(() => sortedJobs.map((job) => String(job.id ?? '')).join(','), [sortedJobs]);

  const stepsByJob = useLiveQuery(async () => {
    const map = new Map<number, StepEntity[]>();
    const jobIds = sortedJobs.map((job) => job.id).filter((id): id is number => typeof id === 'number');
    if (jobIds.length === 0) {
      return map;
    }
    await Promise.all(
      jobIds.map(async (jobId) => {
        const rows = await db.steps.where('jobId').equals(jobId).toArray();
        map.set(jobId, rows);
      })
    );
    return map;
  }, [jobIdsKey], new Map<number, StepEntity[]>());

  const tagDocuments = useLiveQuery(async () => {
    if (!tag || typeof tag.id !== 'number') {
      return [] as TagDocumentEntity[];
    }
    return await listTagDocuments(tag.id);
  }, [tag?.id], []) as TagDocumentEntity[];

  const documentUsage = useLiveQuery(async () => {
    if (!tag || typeof tag.id !== 'number') {
      return { totalCount: 0, totalBytes: 0, tagCount: 0, tagBytes: 0 };
    }
    return await getDocumentUsage(tag.id);
  }, [tag?.id, tagDocuments.length], { totalCount: 0, totalBytes: 0, tagCount: 0, tagBytes: 0 });

  const filteredDocuments = useMemo(() => {
    if (documentFilter === 'all') {
      return tagDocuments;
    }
    return tagDocuments.filter((row) => row.docType === documentFilter);
  }, [documentFilter, tagDocuments]);

  const activeJob = useMemo(() => sortedJobs.find((job) => job.status === 'in-progress'), [sortedJobs]);
  const suspendedJob = useMemo(() => sortedJobs.find((job) => job.status === 'suspended'), [sortedJobs]);

  useEffect(() => {
    const prefs = loadSitePreferences();
    setActiveRole(prefs.activeUserRole);
  }, []);

  useEffect(() => {
    if (!tag) {
      return;
    }
    setMetadataDraft({
      instrumentRole: tag.instrumentRole ?? '',
      safetyLayer: tag.safetyLayer ?? '',
      votingLogic: tag.votingLogic ?? '',
      controlSystem: tag.controlSystem ?? '',
      silTarget: tag.silTarget ?? '',
      proofTestInterval: tag.proofTestInterval ?? '',
      bypassPermitRequired: tag.bypassPermitRequired ?? '',
      functionalOwner: tag.functionalOwner ?? ''
    });
  }, [tag]);

  const lastCompletedCalibration = useMemo(() => {
    return sortedJobs.find((job) => job.status === 'completed' && job.jobType === 'calibration');
  }, [sortedJobs]);

  const failedStepCount = useMemo(() => {
    let total = 0;
    stepsByJob.forEach((steps) => {
      total += steps.filter((step) => step.passFail === 'fail').length;
    });
    return total;
  }, [stepsByJob]);

  const tagStatusLabel = useMemo(() => {
    if (failedStepCount > 0) {
      return 'Exceptions';
    }
    if (activeJob) {
      return 'In Progress';
    }
    if (suspendedJob) {
      return 'Suspended';
    }
    if (sortedJobs.some((job) => job.status === 'cancelled')) {
      return 'Cancelled';
    }
    if (sortedJobs.length === 0) {
      return 'No Jobs';
    }
    return 'Completed';
  }, [activeJob, failedStepCount, sortedJobs, suspendedJob]);

  const nextBestAction = useMemo(() => {
    if (activeJob && typeof activeJob.id === 'number') {
      return { label: `Continue active job #${activeJob.id}`, to: `/jobs/${activeJob.id}` };
    }
    if (suspendedJob && typeof suspendedJob.id === 'number') {
      return { label: `Resume suspended job #${suspendedJob.id}`, to: `/jobs/${suspendedJob.id}` };
    }
    return { label: 'Start a new job for this tag', to: '' };
  }, [activeJob, suspendedJob]);

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

  const hasUnit = typeof tag?.unit === 'string' && tag.unit.trim().length > 0;
  const hasArea = typeof tag?.area === 'string' && tag.area.trim().length > 0;
  const hasService = typeof tag?.service === 'string' && tag.service.trim().length > 0;
  const hasPlant = typeof tag?.plant === 'string' && tag.plant.trim().length > 0;
  const hasType = typeof tag?.type === 'string' && tag.type.trim().length > 0;
  const hasProcessMetadata = hasUnit || hasArea || hasService;

  const lrvValue = Number(tag?.lrv ?? '');
  const urvValue = Number(tag?.urv ?? '');
  const hasValidRange = Number.isFinite(lrvValue) && Number.isFinite(urvValue) && urvValue > lrvValue;

  const onContinueActiveJob = (): void => {
    if (!activeJob || typeof activeJob.id !== 'number') {
      return;
    }
    navigate(`/jobs/${activeJob.id}`);
  };

  const onMetadataFieldChange = (field: keyof typeof metadataDraft, value: string): void => {
    setMetadataDraft((current) => ({
      ...current,
      [field]: value
    }));
  };

  const onCopyMetadataFromSimilar = async (): Promise<void> => {
    if (!tag || typeof tag.id !== 'number') {
      setMetadataError('Tag record is unavailable.');
      return;
    }
    const normalizedType = String(tag.type ?? '').trim();
    if (!normalizedType) {
      setMetadataError('Tag type is required to copy from similar tags.');
      return;
    }
    const peers = (await db.tags.where('type').equals(normalizedType).toArray())
      .filter((candidate) => candidate.id !== tag.id)
      .sort((left, right) => (right.id ?? 0) - (left.id ?? 0));
    const source = peers[0];
    if (!source) {
      setMetadataError('No similar tag found for metadata copy.');
      return;
    }

    setMetadataDraft({
      instrumentRole: source.instrumentRole ?? '',
      safetyLayer: source.safetyLayer ?? '',
      votingLogic: source.votingLogic ?? '',
      controlSystem: source.controlSystem ?? '',
      silTarget: source.silTarget ?? '',
      proofTestInterval: source.proofTestInterval ?? '',
      bypassPermitRequired: source.bypassPermitRequired ?? '',
      functionalOwner: source.functionalOwner ?? ''
    });
    setMetadataError('');
    setStatus(`Loaded metadata from similar ${normalizedType} tag (${source.tagNumber}). Review and save.`);
  };

  const onCancelMetadataEdit = (): void => {
    if (tag) {
      setMetadataDraft({
        instrumentRole: tag.instrumentRole ?? '',
        safetyLayer: tag.safetyLayer ?? '',
        votingLogic: tag.votingLogic ?? '',
        controlSystem: tag.controlSystem ?? '',
        silTarget: tag.silTarget ?? '',
        proofTestInterval: tag.proofTestInterval ?? '',
        bypassPermitRequired: tag.bypassPermitRequired ?? '',
        functionalOwner: tag.functionalOwner ?? ''
      });
    }
    setMetadataError('');
    setIsEditingMetadata(false);
  };

  const onSaveMetadata = async (): Promise<void> => {
    if (!tag || typeof tag.id !== 'number') {
      setMetadataError('Tag record is unavailable.');
      return;
    }

    const normalizedVoting = metadataDraft.votingLogic.trim().toLowerCase();
    if (normalizedVoting && !/^[1-4]oo[1-4]$/.test(normalizedVoting)) {
      setMetadataError('Voting logic must look like 1oo1, 2oo2, or 2oo3.');
      return;
    }

    try {
      await updateTag(tag.id, {
        instrumentRole: metadataDraft.instrumentRole.trim(),
        safetyLayer: metadataDraft.safetyLayer.trim().toUpperCase(),
        votingLogic: metadataDraft.votingLogic.trim().toLowerCase(),
        controlSystem: metadataDraft.controlSystem.trim(),
        silTarget: metadataDraft.silTarget.trim().toUpperCase(),
        proofTestInterval: metadataDraft.proofTestInterval.trim(),
        bypassPermitRequired: metadataDraft.bypassPermitRequired.trim(),
        functionalOwner: metadataDraft.functionalOwner.trim()
      });
      setMetadataError('');
      setStatus('Tag metadata updated.');
      setError('');
      setIsEditingMetadata(false);
    } catch (saveError) {
      setMetadataError(saveError instanceof Error ? saveError.message : 'Failed to save metadata.');
    }
  };

  const onUploadDocument = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';

    if (!file) {
      return;
    }
    if (!tag || typeof tag.id !== 'number') {
      setError('Tag record is unavailable.');
      return;
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
      setError('Unsupported file type. Use PDF, JPG, PNG, WEBP, DOCX, or XLSX.');
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError(`Document exceeds 5 MB limit: ${file.name}`);
      return;
    }
    if (documentUsage.tagCount >= MAX_DOCUMENTS_PER_TAG) {
      setError('This tag already has the maximum of 10 documents.');
      return;
    }
    if (documentUsage.tagBytes + file.size > MAX_DOCUMENT_BYTES_PER_TAG) {
      setError('This upload exceeds the 30 MB per-tag document limit.');
      return;
    }
    if (documentUsage.totalBytes + file.size > MAX_DOCUMENT_BYTES_GLOBAL) {
      setError('This upload exceeds the 300 MB app document storage limit.');
      return;
    }

    try {
      await addTagDocument({
        tagId: tag.id,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        docType: selectedDocType,
        uploadedAt: new Date().toISOString(),
        uploadedBy: uploadedBy.trim() || 'Tech',
        file
      });
      setStatus(`Document uploaded: ${file.name}`);
      setError('');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload document.');
    }
  };

  const onDeleteDocument = async (documentId: number): Promise<void> => {
    try {
      await deleteTagDocument(documentId);
      setStatus('Document removed.');
      setError('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete document.');
    }
  };

  const onDownloadDocument = (tagDocument: TagDocumentEntity): void => {
    const url = URL.createObjectURL(tagDocument.file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = tagDocument.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const deleteRequiresSignature = Boolean(activeJob && tagDocuments.length > 0);
  const deleteBlockedByOpenExceptions = Boolean(activeJob && failedStepCount > 0);
  const canStartDelete = activeRole === 'lead' || activeRole === 'admin';

  const onDeleteTag = async (): Promise<void> => {
    if (!tag || typeof tag.id !== 'number') {
      setError('Tag record is unavailable.');
      return;
    }
    if (deleteBlockedByOpenExceptions) {
      setError('Deletion blocked: active tag has unresolved exceptions. Resolve or close the active job first.');
      return;
    }
    if (!canStartDelete) {
      setError('Only Lead or Admin can delete tags.');
      return;
    }
    if (deleteConfirmTag.trim() !== tag.tagNumber) {
      setError(`Type exact tag number (${tag.tagNumber}) to confirm deletion.`);
      return;
    }
    if (countWords(deleteReason) < 5) {
      setError('Deletion reason must be at least 5 words.');
      return;
    }
    if (deleteRequiresSignature) {
      if (!deleteSigner.trim()) {
        setError('Signer name is required for active tag deletion with documents.');
        return;
      }
      if (!deleteSignatureBlob) {
        setError('Signature is required for active tag deletion with documents.');
        return;
      }
    }

    try {
      await deleteTagWithCascade(tag.id, {
        requestedBy: deleteRequiresSignature ? deleteSigner : 'local-user',
        reason: deleteReason,
        signedAuthorization: deleteRequiresSignature ? { signer: deleteSigner, signatureBlob: deleteSignatureBlob as Blob } : undefined
      });
      setStatus(`Tag ${tag.tagNumber} deleted.`);
      setError('');
      navigate(`/tags${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
    } catch (deleteErr) {
      setError(deleteErr instanceof Error ? deleteErr.message : 'Failed to delete tag.');
    }
  };

  return (
    <section className="lv-page">
      <button
        className="lv-btn-secondary"
        onClick={() => navigate(`/tags${searchParams.toString() ? `?${searchParams.toString()}` : ''}`)}
        type="button"
      >
        Back to Tags
      </button>
      <Link className="lv-btn-secondary" to="/help">
        Help & Docs
      </Link>

      {!tag ? <p className="rounded-lg border border-red-500 bg-red-950 p-3 text-sm">Tag not found.</p> : null}

      {tag ? (
        <>
          <p className="text-xs text-slate-300">Context: Tags / {tag.plant || '-'} / {tag.unit || '-'} / {tag.tagNumber}</p>
          <div className="lv-panel-light text-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-2xl font-bold text-safety">{tag.tagNumber}</h2>
              {tagStatusLabel === 'In Progress' && activeJob && typeof activeJob.id === 'number' ? (
                <StatusChip label={tagStatusLabel} onClick={onContinueActiveJob} tone="caution" />
              ) : (
                <StatusChip
                  label={tagStatusLabel}
                  tone={
                    tagStatusLabel === 'Exceptions'
                      ? 'danger'
                      : tagStatusLabel === 'In Progress'
                        ? 'caution'
                        : tagStatusLabel === 'Suspended'
                          ? 'warning'
                          : tagStatusLabel === 'Completed'
                            ? 'success'
                            : 'neutral'
                  }
                />
              )}
            </div>
            <p className="mt-2 text-xl font-extrabold">{tag.description || 'No description'}</p>
            <p className="mt-2 text-sm font-semibold">Type {hasType ? tag.type : '-'} • Plant {hasPlant ? tag.plant : '-'}</p>
            <p className="mt-1 text-sm">Unit {hasUnit ? tag.unit : '-'} • Area {hasArea ? tag.area : '-'} • Service {hasService ? tag.service : '-'}</p>
            <p className="mt-1 text-sm">
              Role {tag.instrumentRole || '-'} • Safety {tag.safetyLayer || '-'} • Voting {tag.votingLogic || '-'}
            </p>
            <p className="mt-1 text-sm">
              SIL {tag.silTarget || '-'} • Proof Test {tag.proofTestInterval || '-'} • Bypass Permit {tag.bypassPermitRequired || '-'}
            </p>
          </div>

          <div className="lv-panel-light text-slate-900">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Control & Safety Metadata</p>
              {!isEditingMetadata ? (
                <button className="lv-btn-secondary min-h-[36px] px-3 py-2 text-xs" onClick={() => setIsEditingMetadata(true)} type="button">
                  Edit Metadata
                </button>
              ) : null}
            </div>

            {!isEditingMetadata ? (
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <p>
                  <span className="font-semibold">Instrument Role:</span> {tag.instrumentRole || '-'}
                </p>
                <p>
                  <span className="font-semibold">Safety Layer:</span> {tag.safetyLayer || '-'}
                </p>
                <p>
                  <span className="font-semibold">Voting Logic:</span> {tag.votingLogic || '-'}
                </p>
                <p>
                  <span className="font-semibold">Control System:</span> {tag.controlSystem || '-'}
                </p>
                <p>
                  <span className="font-semibold">SIL Target:</span> {tag.silTarget || '-'}
                </p>
                <p>
                  <span className="font-semibold">Proof Test Interval:</span> {tag.proofTestInterval || '-'}
                </p>
                <p>
                  <span className="font-semibold">Bypass Permit:</span> {tag.bypassPermitRequired || '-'}
                </p>
                <p>
                  <span className="font-semibold">Functional Owner:</span> {tag.functionalOwner || '-'}
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <button className="lv-btn-secondary min-h-[40px] px-3 py-2 text-sm" onClick={() => void onCopyMetadataFromSimilar()} type="button">
                  Copy From Latest Similar Tag
                </button>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="text-slate-700">Instrument Role</span>
                    <input
                      className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white p-2 text-slate-900"
                      onChange={(event) => onMetadataFieldChange('instrumentRole', event.currentTarget.value)}
                      placeholder="Control / Indicator / Alarm"
                      type="text"
                      value={metadataDraft.instrumentRole}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-700">Safety Layer</span>
                    <input
                      className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white p-2 text-slate-900"
                      onChange={(event) => onMetadataFieldChange('safetyLayer', event.currentTarget.value.toUpperCase())}
                      placeholder="PIS / SIS / IPF / Shutdown"
                      type="text"
                      value={metadataDraft.safetyLayer}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-700">Voting Logic</span>
                    <input
                      className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white p-2 text-slate-900"
                      onChange={(event) => onMetadataFieldChange('votingLogic', event.currentTarget.value)}
                      placeholder="1oo1 / 2oo2 / 2oo3"
                      type="text"
                      value={metadataDraft.votingLogic}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-700">Control System</span>
                    <input
                      className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white p-2 text-slate-900"
                      onChange={(event) => onMetadataFieldChange('controlSystem', event.currentTarget.value)}
                      placeholder="Computer Control / PLC / DCS"
                      type="text"
                      value={metadataDraft.controlSystem}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-700">SIL Target</span>
                    <input
                      className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white p-2 text-slate-900"
                      onChange={(event) => onMetadataFieldChange('silTarget', event.currentTarget.value.toUpperCase())}
                      placeholder="SIL1 / SIL2 / SIL3"
                      type="text"
                      value={metadataDraft.silTarget}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-700">Proof Test Interval</span>
                    <input
                      className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white p-2 text-slate-900"
                      onChange={(event) => onMetadataFieldChange('proofTestInterval', event.currentTarget.value)}
                      placeholder="6 months / 12 months"
                      type="text"
                      value={metadataDraft.proofTestInterval}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-700">Bypass Permit Required</span>
                    <input
                      className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white p-2 text-slate-900"
                      onChange={(event) => onMetadataFieldChange('bypassPermitRequired', event.currentTarget.value)}
                      placeholder="Yes / No"
                      type="text"
                      value={metadataDraft.bypassPermitRequired}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-700">Functional Owner</span>
                    <input
                      className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white p-2 text-slate-900"
                      onChange={(event) => onMetadataFieldChange('functionalOwner', event.currentTarget.value)}
                      placeholder="Process Safety / Instrumentation"
                      type="text"
                      value={metadataDraft.functionalOwner}
                    />
                  </label>
                </div>
                {metadataError ? <p className="rounded-lg border border-red-500 bg-red-950 p-2 text-xs text-red-100">{metadataError}</p> : null}
                <div className="flex gap-2">
                  <button className="lv-btn-primary min-h-[40px] px-3 py-2 text-sm" onClick={() => void onSaveMetadata()} type="button">
                    Save Metadata
                  </button>
                  <button className="lv-btn-secondary min-h-[40px] px-3 py-2 text-sm" onClick={onCancelMetadataEdit} type="button">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="lv-panel-light text-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Process Range</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <p>
                <span className="font-semibold">LRV:</span> {tag.lrv || '-'}
              </p>
              <p>
                <span className="font-semibold">URV:</span> {tag.urv || '-'}
              </p>
              <p>
                <span className="font-semibold">Eng Unit:</span> {tag.engUnit || '-'}
              </p>
              <p>
                <span className="font-semibold">Transfer:</span> {tag.transferFunction || '-'}
              </p>
              <p>
                <span className="font-semibold">Max Error:</span> {tag.maxError || '-'}
              </p>
              <p>
                <span className="font-semibold">Fail Safe:</span> {tag.failSafe || '-'}
              </p>
            </div>
            {!hasValidRange ? <p className="mt-3 rounded-lg border border-amber-500 bg-amber-950/40 p-2 text-xs text-amber-200">Range warning: verify LRV/URV values before starting calibration (URV must be greater than LRV).</p> : null}
          </div>

          {!hasProcessMetadata ? <p className="rounded-lg border border-amber-500 bg-amber-950/40 p-3 text-sm text-amber-200">Process metadata not provided in CSV.</p> : null}

          <div className="lv-panel text-sm">
            <p>
              <span className="font-semibold">Last Completed Calibration:</span>{' '}
              {lastCompletedCalibration && lastCompletedCalibration.completedAt
                ? `${lastCompletedCalibration.completedAt.slice(0, 10)} • ${lastCompletedCalibration.techName}`
                : 'No completed calibration yet'}
            </p>
            <p className="mt-1">
              <span className="font-semibold">Exceptions:</span> {failedStepCount}
            </p>
          </div>

          <section className="lv-panel border-amber-500 bg-amber-950/25">
            <h3 className="text-base font-semibold text-amber-200">Next Best Action</h3>
            <p className="mt-1 text-sm text-amber-100">{nextBestAction.label}</p>
            {nextBestAction.to ? (
              <button className="lv-btn-secondary mt-2 min-h-[40px] px-3 py-2 text-sm" onClick={() => navigate(nextBestAction.to)} type="button">
                Open
              </button>
            ) : (
              <button className="lv-btn-secondary mt-2 min-h-[40px] px-3 py-2 text-sm" onClick={() => setShowNewJobModal(true)} type="button">
                Create Job
              </button>
            )}
          </section>

          <TagQRCode tagNumber={tag.tagNumber} />

          <div className="lv-panel text-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-safety">Tag Documents</h3>
              <span className="rounded-md bg-slate-700 px-2 py-1 text-xs">
                {documentUsage.tagCount}/{MAX_DOCUMENTS_PER_TAG}
              </span>
            </div>

            <p className="mt-2 text-xs text-slate-300">
              Per file: {formatBytes(MAX_DOCUMENT_BYTES)} • Tag cap: {formatBytes(MAX_DOCUMENT_BYTES_PER_TAG)} • App cap: {formatBytes(MAX_DOCUMENT_BYTES_GLOBAL)}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Tag usage: {formatBytes(documentUsage.tagBytes)} • App usage: {formatBytes(documentUsage.totalBytes)}
            </p>
            {documentUsage.totalBytes >= MAX_DOCUMENT_BYTES_GLOBAL * 0.8 ? <p className="mt-2 rounded-lg border border-amber-500 bg-amber-950/40 p-2 text-xs text-amber-200">Warning: app document storage is above 80%.</p> : null}

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <label className="block text-xs text-slate-300">
                Document Type
                <select className="lv-input mt-1 min-h-[40px] p-2" onChange={(event) => setSelectedDocType(event.currentTarget.value)} value={selectedDocType}>
                  <option value="loop-sheet">Loop Sheet</option>
                  <option value="pid">P&ID</option>
                  <option value="datasheet">Data Sheet</option>
                  <option value="manual">MFG Manual</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block text-xs text-slate-300 md:col-span-2">
                Uploaded By
                <input className="lv-input mt-1 min-h-[40px] p-2" onChange={(event) => setUploadedBy(event.currentTarget.value)} placeholder="Tech or Supervisor" type="text" value={uploadedBy} />
              </label>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <label className="block text-xs text-slate-300 md:col-span-3">
                Filter Documents
                <select className="lv-input mt-1 min-h-[40px] p-2" onChange={(event) => setDocumentFilter(event.currentTarget.value)} value={documentFilter}>
                  <option value="all">All Types</option>
                  <option value="loop-sheet">Loop Sheet</option>
                  <option value="pid">P&amp;ID</option>
                  <option value="datasheet">Data Sheet</option>
                  <option value="manual">MFG Manual</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <button
                className="lv-btn-secondary min-h-[40px] self-end px-3 py-2 text-xs"
                onClick={() => setDocumentFilter('all')}
                type="button"
              >
                Clear Filter
              </button>
            </div>

            <label className="lv-btn-secondary mt-3 cursor-pointer">
              Upload Document
              <input
                accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={documentUsage.tagCount >= MAX_DOCUMENTS_PER_TAG || documentUsage.tagBytes >= MAX_DOCUMENT_BYTES_PER_TAG || documentUsage.totalBytes >= MAX_DOCUMENT_BYTES_GLOBAL}
                onChange={(event) => void onUploadDocument(event)}
                type="file"
              />
            </label>

            {tagDocuments.length === 0 ? <p className="mt-3 text-xs text-slate-300">No documents uploaded for this tag.</p> : null}
            {tagDocuments.length > 0 && filteredDocuments.length === 0 ? <p className="mt-3 text-xs text-slate-300">No documents match this filter.</p> : null}
            {filteredDocuments.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {filteredDocuments.map((documentRecord) => (
                  <li className="rounded-lg border border-slate-600 bg-slate-900 p-3" key={documentRecord.id}>
                    <p className="text-sm font-semibold text-slate-100">{documentRecord.name}</p>
                    <p className="text-xs text-slate-300">
                      {documentRecord.docType} • {formatBytes(documentRecord.size)} • {documentRecord.uploadedBy || '-'} • {documentRecord.uploadedAt.slice(0, 10)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button className="lv-btn-secondary min-h-[36px] px-3 py-2 text-xs" onClick={() => onDownloadDocument(documentRecord)} type="button">
                        Download
                      </button>
                      {typeof documentRecord.id === 'number' ? (
                        <button className="lv-btn-danger min-h-[36px] px-3 py-2 text-xs" onClick={() => void onDeleteDocument(documentRecord.id as number)} type="button">
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {status ? <p aria-live="polite" className="rounded-lg border border-emerald-400 bg-emerald-950 p-3 text-sm font-semibold text-emerald-100">✓ {status}</p> : null}
          {error ? <p aria-live="assertive" className="rounded-lg border border-red-500 bg-red-950 p-3 text-sm">{error}</p> : null}

          <div className="grid gap-3">
            {activeJob && typeof activeJob.id === 'number' ? (
              <button className="lv-btn-primary min-h-16 text-lg" onClick={onContinueActiveJob} type="button">
                ▶ Continue Active Job #{activeJob.id}
              </button>
            ) : null}
            {!activeJob && suspendedJob && typeof suspendedJob.id === 'number' ? (
              <button className="lv-btn-secondary min-h-16 text-lg" onClick={() => navigate(`/jobs/${suspendedJob.id}`)} type="button">
                ▶ Resume Suspended Job #{suspendedJob.id}
              </button>
            ) : null}
            <button
              className="lv-btn-primary min-h-16 text-lg"
              onClick={() => setShowNewJobModal(true)}
              type="button"
            >
              ✓ New Job
            </button>
            <button
              className="lv-btn-secondary min-h-16 text-lg"
              onClick={() => setShowHistory((prev) => !prev)}
              type="button"
            >
              History
            </button>
            <button
              className="lv-btn-danger min-h-16 text-lg disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canStartDelete}
              onClick={() => setShowDeleteLayer1((current) => !current)}
              type="button"
            >
              Delete Tag
            </button>
            {!canStartDelete ? <p className="text-xs text-amber-200">Lead/Admin role required for deletion. Current role: {activeRole.toUpperCase()}.</p> : null}
            {deleteBlockedByOpenExceptions ? <p className="text-xs text-red-300">Delete lockout: active job has unresolved exceptions.</p> : null}
          </div>

          {showDeleteLayer1 ? (
            <section className="lv-panel border-red-500 bg-red-950/25">
              <h3 className="text-base font-semibold text-red-200">Danger Zone: Delete Tag</h3>
              <p className="mt-2 text-sm text-red-100">This removes the tag, all jobs, all steps, signatures, evidence photos, and documents tied to it.</p>
              <button className="lv-btn-danger mt-3" onClick={() => setShowDeleteLayer2(true)} type="button">
                Continue to Final Confirmation
              </button>
            </section>
          ) : null}

          {showDeleteLayer2 ? (
            <section className="lv-panel space-y-3 border-red-500 bg-red-950/30">
              <h3 className="text-base font-semibold text-red-200">Final Confirmation</h3>
              <p className="text-xs text-red-100">Type the exact tag number and provide reason before deletion.</p>
              <label className="block text-xs text-red-100">
                Confirm Tag Number
                <input
                  className="lv-input mt-1 min-h-[40px] p-2"
                  onChange={(event) => setDeleteConfirmTag(event.currentTarget.value)}
                  placeholder={tag.tagNumber}
                  type="text"
                  value={deleteConfirmTag}
                />
              </label>
              <label className="block text-xs text-red-100">
                Standard Reason
                <select
                  className="lv-input mt-1 min-h-[40px] p-2"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDeleteReasonTemplate(value);
                    if (value) {
                      setDeleteReason(value);
                    }
                  }}
                  value={deleteReasonTemplate}
                >
                  <option value="">Custom reason</option>
                  <option value="Duplicate tag record imported in error and verified against latest loop index.">Duplicate tag cleanup</option>
                  <option value="Tag retired from service and all associated loop records archived per site policy.">Asset retired</option>
                  <option value="Tag replaced by new instrument ID and migration completed with supervisor approval.">Tag superseded</option>
                </select>
              </label>
              <label className="block text-xs text-red-100">
                Deletion Reason (minimum 5 words)
                <textarea
                  className="lv-input mt-1 min-h-[72px] p-2"
                  onChange={(event) => setDeleteReason(event.currentTarget.value)}
                  placeholder="Reason for deletion and confirmation this is intentional."
                  value={deleteReason}
                />
              </label>
              {deleteRequiresSignature ? (
                <div className="rounded-lg border border-amber-500 bg-amber-950/40 p-3">
                  <p className="text-xs text-amber-200">Active tag with documents detected. Signed authorization is required.</p>
                  <label className="mt-2 block text-xs text-amber-100">
                    Signer Name
                    <input
                      className="lv-input mt-1 min-h-[40px] p-2"
                      onChange={(event) => setDeleteSigner(event.currentTarget.value)}
                      placeholder="Supervisor / Authorized User"
                      type="text"
                      value={deleteSigner}
                    />
                  </label>
                  <SignatureCapture onSignatureChange={setDeleteSignatureBlob} />
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <button className="lv-btn-secondary" onClick={() => setShowDeleteLayer2(false)} type="button">
                  Cancel
                </button>
                <button className="lv-btn-danger" onClick={() => void onDeleteTag()} type="button">
                  Confirm Delete
                </button>
              </div>
            </section>
          ) : null}

          {showHistory ? (
            <div className="lv-panel text-sm">
              {sortedJobs.length === 0 ? (
                <p>No job history yet.</p>
              ) : (
                <ul className="space-y-2">
                  {sortedJobs.map((job) => {
                    const jobId = job.id as number | undefined;
                    const failCount = typeof jobId === 'number' ? (stepsByJob.get(jobId) ?? []).filter((step) => step.passFail === 'fail').length : 0;
                    return (
                      <li className="rounded-xl border border-slate-600 bg-slate-900 p-3" key={job.id}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">#{job.id} • {job.jobType}</p>
                          {job.status === 'in-progress' && typeof job.id === 'number' ? (
                            <button className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-black" onClick={() => navigate(`/jobs/${job.id}`)} type="button">
                              In Progress
                            </button>
                          ) : (
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                                job.status === 'in-progress'
                                  ? 'bg-amber-500 text-black'
                                  : job.status === 'suspended'
                                    ? 'bg-amber-700 text-white'
                                    : job.status === 'cancelled'
                                      ? 'bg-slate-700 text-white'
                                      : 'bg-emerald-600 text-white'
                              }`}
                            >
                              {job.status === 'in-progress'
                                ? 'In Progress'
                                : job.status === 'suspended'
                                  ? 'Suspended'
                                  : job.status === 'cancelled'
                                    ? 'Cancelled'
                                    : 'Completed'}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-300">Tech: {job.techName || '-'}</p>
                        {job.postponedUntil ? <p className="text-xs text-slate-300">Postponed Until: {job.postponedUntil}</p> : null}
                        {job.lifecycleNotes ? <p className="text-xs text-slate-300">Notes: {job.lifecycleNotes}</p> : null}
                        <p className="text-xs text-slate-300">Exceptions: {failCount}</p>
                        {typeof job.id === 'number' ? (
                          <button className="lv-btn-secondary mt-2 min-h-[36px] px-3 py-2 text-xs" onClick={() => navigate(`/jobs/${job.id}`)} type="button">
                            Open Job
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {showNewJobModal ? (
            <div className="lv-panel">
              <h3 className="mb-3 text-lg font-semibold">Create Job</h3>
              <div className="grid gap-2">
                <button className="lv-btn-primary min-h-14" onClick={() => void onCreateJob('loop-check')} type="button">
                  Loop Check
                </button>
                <button className="lv-btn-primary min-h-14" onClick={() => void onCreateJob('calibration')} type="button">
                  Calibration
                </button>
                <button className="lv-btn-secondary" onClick={() => setShowNewJobModal(false)} type="button">
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

function countWords(input: string): number {
  return input
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function SignatureCapture(props: { onSignatureChange: (blob: Blob | null) => void }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 120;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.scale(ratio, ratio);
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.strokeStyle = '#111111';
  }, []);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) {
      return;
    }
    const point = pointFromEvent(event);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!drawingRef.current) {
      return;
    }
    const context = canvasRef.current?.getContext('2d');
    if (!context) {
      return;
    }
    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const commitSignature = (): void => {
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.toBlob((blob) => {
      props.onSignatureChange(blob ?? null);
    }, 'image/png');
  };

  const onClear = (): void => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    props.onSignatureChange(null);
  };

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-amber-100">Signer Authorization Signature</p>
      <div className="rounded-lg bg-white p-2">
        <canvas
          className="h-28 w-full touch-none rounded border border-slate-300"
          onPointerDown={onPointerDown}
          onPointerLeave={commitSignature}
          onPointerMove={onPointerMove}
          onPointerUp={commitSignature}
          ref={canvasRef}
        />
      </div>
      <button className="min-h-[36px] rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-900" onClick={onClear} type="button">
        Clear Signature
      </button>
    </div>
  );
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
