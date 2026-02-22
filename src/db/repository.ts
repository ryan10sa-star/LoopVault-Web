import type { TemplateStep } from '../templates';
import { loadSitePreferences } from '../config/sitePreferences';
import { db } from './schema';

export interface TagEntity {
  id?: number;
  tagNumber: string;
  type: string;
  plant: string;
  instrumentRole: string;
  safetyLayer: string;
  votingLogic: string;
  controlSystem: string;
  silTarget: string;
  proofTestInterval: string;
  bypassPermitRequired: string;
  functionalOwner: string;
  description: string;
  area: string;
  unit: string;
  service: string;
  lrv: string;
  urv: string;
  engUnit: string;
  transferFunction: string;
  failSafe: string;
  maxError: string;
  testEquipment: string;
  testEquipmentCalDate: string;
}

export interface JobEntity {
  id?: number;
  tagId: number;
  jobType: 'loop-check' | 'calibration';
  status: 'in-progress' | 'suspended' | 'cancelled' | 'completed';
  techName: string;
  createdAt?: string;
  configValues?: Record<string, string>;
  postponedUntil?: string;
  lifecycleNotes?: string;
  completedAt?: string;
}

export interface StepEntity {
  id?: number;
  jobId: number;
  templateStepId: string;
  title: string;
  inputType: 'passfail' | 'number' | 'text';
  unit?: string;
  passFail: 'pass' | 'fail' | 'na' | '';
  valueNumber?: number;
  valueText: string;
}

export interface EvidenceEntity {
  id?: number;
  stepId: number;
  type: 'photo';
  file: Blob;
}

export interface SignatureEntity {
  id?: number;
  jobId: number;
  signedBy: string;
  signedAt: string;
  signatureHash: string;
  jobSnapshotHash: string;
  file: Blob;
}

export interface AuditEventEntity {
  id?: number;
  timestamp: string;
  utcTimestamp?: string;
  localTimestamp?: string;
  timezoneOffsetMinutes?: number;
  sequence?: number;
  role?: string;
  deviceId?: string;
  entityType: 'tag' | 'job' | 'step' | 'signature' | 'document' | 'system';
  entityId: number;
  action: string;
  actor: string;
  summary: string;
}

export interface DeleteTagOptions {
  requestedBy: string;
  reason: string;
  signedAuthorization?: {
    signer: string;
    signatureBlob: Blob;
  };
}

export interface TagDocumentEntity {
  id?: number;
  tagId: number;
  name: string;
  mimeType: string;
  size: number;
  docType: string;
  uploadedAt: string;
  uploadedBy: string;
  file: Blob;
}

export interface FullStep {
  step: StepEntity;
  evidence: EvidenceEntity[];
}

export interface FullJob {
  job: JobEntity;
  steps: FullStep[];
}

export interface JobRunnerData {
  job: JobEntity;
  tag: TagEntity;
  steps: StepEntity[];
}

export interface DocumentUsageSummary {
  totalCount: number;
  totalBytes: number;
  tagCount: number;
  tagBytes: number;
}

export interface ReopenCompletedJobOptions {
  approverName: string;
  approverRole: 'lead' | 'admin';
  reason: string;
}

export async function upsertTagsBulk(tags: TagEntity[]): Promise<void> {
  if (tags.length === 0) {
    return;
  }
  await db.transaction('rw', db.tags, async () => {
    await db.tags.bulkPut(tags);
  });
}

export async function createTag(tag: TagEntity): Promise<number> {
  return await db.tags.add(tag);
}

export async function getTagByNumber(tagNumber: string): Promise<TagEntity | undefined> {
  const matches = await db.tags.where('tagNumber').equals(tagNumber).toArray();
  return matches[0];
}

export async function getFullJob(jobId: number): Promise<FullJob | null> {
  const job = await db.jobs.get(jobId);
  if (!job || typeof job.id !== 'number') {
    return null;
  }

  const steps = await db.steps.where('jobId').equals(job.id).toArray();
  const stepsWithEvidence: FullStep[] = await Promise.all(
    steps.map(async (step) => {
      const stepId = step.id;
      const evidence = typeof stepId === 'number' ? await db.evidence.where('stepId').equals(stepId).toArray() : [];
      return { step, evidence };
    })
  );

  return {
    job,
    steps: stepsWithEvidence
  };
}

export async function addEvidence(stepId: number, file: Blob): Promise<number> {
  const evidence: EvidenceEntity = {
    stepId,
    type: 'photo',
    file
  };
  const id = await db.evidence.add(evidence);
  await logAuditEvent('step', stepId, 'evidence.added', 'local-user', `Added photo evidence to step #${stepId}`);
  return id;
}

export async function createJobFromTemplate(tagId: number, jobType: JobEntity['jobType'], templateSteps: TemplateStep[]): Promise<number> {
  const jobId = await db.jobs.add({
    tagId,
    jobType,
    status: 'in-progress',
    techName: 'Unassigned',
    createdAt: new Date().toISOString()
  });

  await db.steps.bulkAdd(
    templateSteps.map((step) => ({
      jobId,
      templateStepId: step.templateStepId,
      title: step.title,
      inputType: step.inputType,
      unit: step.unit,
      passFail: '',
      valueText: ''
    }))
  );

  await logAuditEvent('job', jobId, 'job.created', 'local-user', `Created ${jobType} job from template with ${templateSteps.length} step(s)`);

  return jobId;
}

export async function ensureCalibrationInspectionSteps(jobId: number, existingSteps: StepEntity[], templateSteps: TemplateStep[]): Promise<number> {
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return 0;
  }

  const inspectionTemplateSteps = templateSteps.filter(
    (step) =>
      step.inputType === 'passfail' &&
      (String(step.templateStepId ?? '').startsWith('CAL-INSP-') || String(step.title ?? '').startsWith('Inspection:'))
  );

  if (inspectionTemplateSteps.length === 0) {
    return 0;
  }

  const existingTemplateIds = new Set(existingSteps.map((step) => String(step.templateStepId ?? '')));
  const missing = inspectionTemplateSteps.filter((step) => !existingTemplateIds.has(String(step.templateStepId ?? '')));

  if (missing.length === 0) {
    return 0;
  }

  await db.steps.bulkAdd(
    missing.map((step) => ({
      jobId,
      templateStepId: String(step.templateStepId ?? ''),
      title: String(step.title ?? 'Inspection Item'),
      inputType: 'passfail' as const,
      unit: step.unit,
      passFail: '',
      valueText: ''
    }))
  );

  return missing.length;
}


export async function saveSignature(jobId: number, signedBy: string, file: Blob): Promise<void> {
  if (!Number.isFinite(jobId) || jobId <= 0) {
    throw new Error('Invalid job ID for signature save.');
  }

  const signedAt = new Date().toISOString();
  const signatureHash = await computeBlobSha256(file);
  const jobSnapshotHash = await computeJobSnapshotHash(jobId);
  const normalizedSigner = signedBy.trim() || 'Unassigned';

  await db.transaction('rw', db.signatures, async () => {
    const existing = (await db.signatures.where('jobId').equals(jobId).toArray())[0];
    const nextRecord: SignatureEntity = {
      id: typeof existing?.id === 'number' ? existing.id : undefined,
      jobId,
      signedBy: normalizedSigner,
      signedAt,
      signatureHash,
      jobSnapshotHash,
      file
    };

    if (typeof nextRecord.id === 'number') {
      await db.signatures.put(nextRecord);
    } else {
      await db.signatures.add(nextRecord);
    }
  });

  await logAuditEvent('signature', jobId, 'signature.saved', normalizedSigner, `Signature saved for job #${jobId}`);
}

export async function getSignatureByJob(jobId: number): Promise<SignatureEntity | null> {
  const signature = (await db.signatures.where('jobId').equals(jobId).toArray())[0];
  if (!signature) {
    return null;
  }
  return {
    ...signature,
    signedBy: String(signature.signedBy ?? ''),
    signedAt: String(signature.signedAt ?? ''),
    signatureHash: String(signature.signatureHash ?? ''),
    jobSnapshotHash: String(signature.jobSnapshotHash ?? '')
  };
}

export async function listEvidenceByJob(jobId: number): Promise<Array<{ step: StepEntity; records: EvidenceEntity[] }>> {
  const steps = await db.steps.where('jobId').equals(jobId).toArray();
  return await Promise.all(
    steps.map(async (step) => {
      const records = typeof step.id === 'number' ? await db.evidence.where('stepId').equals(step.id).toArray() : [];
      return { step, records };
    })
  );
}

export async function updateJobTechName(jobId: number, techName: string): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) {
    return;
  }
  await db.jobs.put({ ...job, id: jobId, techName });
  await logAuditEvent('job', jobId, 'job.tech.updated', techName, 'Updated assigned technician');
}

export async function updateJobConfigValue(jobId: number, fieldId: string, value: string): Promise<void> {
  const existing = await db.jobs.get(jobId);
  if (!existing) {
    return;
  }

  await db.transaction('rw', db.jobs, async () => {
    const job = await db.jobs.get(jobId);
    if (!job) {
      return;
    }
    await db.jobs.put({
      ...job,
      id: jobId,
      configValues: {
        ...(job.configValues ?? {}),
        [fieldId]: value
      }
    });
  });
  await markSignatureStaleIfChanged(jobId, `config change: ${fieldId}`);
  await logAuditEvent('job', jobId, 'job.config.updated', 'local-user', `Updated config field ${fieldId}`);
}

export async function updateTag(tagId: number, patch: Partial<TagEntity>): Promise<void> {
  const current = await db.tags.get(tagId);
  if (!current) {
    return;
  }
  await db.tags.put({ ...current, ...patch, id: tagId });
  await logAuditEvent('tag', tagId, 'tag.updated', 'local-user', `Updated tag fields: ${Object.keys(patch).join(', ')}`);
}

export async function getJobsByTag(tagId: number): Promise<JobEntity[]> {
  return await db.jobs.where('tagId').equals(tagId).toArray();
}

export async function getJobRunnerData(jobId: number): Promise<JobRunnerData | null> {
  const job = await db.jobs.get(jobId);
  if (!job || typeof job.id !== 'number') {
    return null;
  }
  const tag = await db.tags.get(job.tagId);
  if (!tag) {
    return null;
  }
  const rawSteps = (await db.steps.where('jobId').equals(job.id).toArray()) as unknown[];

  const normalizedJob: JobEntity = {
    ...job,
    techName: String(job.techName ?? ''),
    configValues: normalizeConfigValues(job.configValues)
  };

  const safeJobId = typeof job.id === 'number' ? job.id : jobId;
  const normalizedSteps: StepEntity[] = [];
  rawSteps.forEach((rawStep, index) => {
    if (!rawStep || typeof rawStep !== 'object') {
      return;
    }

    const step = rawStep as Partial<StepEntity>;
    const inputType: StepEntity['inputType'] =
      step.inputType === 'passfail' || step.inputType === 'number' || step.inputType === 'text' ? step.inputType : 'text';
    const normalizedPassFail: StepEntity['passFail'] =
      step.passFail === 'pass' || step.passFail === 'fail' || step.passFail === 'na' ? step.passFail : '';

    normalizedSteps.push({
      id: typeof step.id === 'number' ? step.id : undefined,
      jobId: typeof step.jobId === 'number' ? step.jobId : safeJobId,
      templateStepId: String(step.templateStepId ?? `STEP-${index + 1}`),
      title: String(step.title ?? `Step ${index + 1}`),
      inputType,
      unit: typeof step.unit === 'string' ? step.unit : undefined,
      passFail: normalizedPassFail,
      valueNumber: typeof step.valueNumber === 'number' && Number.isFinite(step.valueNumber) ? step.valueNumber : undefined,
      valueText: typeof step.valueText === 'string' ? step.valueText : ''
    });
  });

  return { job: normalizedJob, tag, steps: normalizedSteps };
}

function normalizeConfigValues(input: JobEntity['configValues']): Record<string, string> {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    normalized[String(key)] = typeof value === 'string' ? value : String(value ?? '');
  }
  return normalized;
}

async function computeBlobSha256(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  return await computeSha256FromBytes(bytes);
}

async function computeJobSnapshotHash(jobId: number): Promise<string> {
  const [job, steps] = await Promise.all([db.jobs.get(jobId), db.steps.where('jobId').equals(jobId).toArray()]);
  const payload = JSON.stringify({
    job: job ?? null,
    steps: [...steps].sort((left, right) => (left.id ?? 0) - (right.id ?? 0))
  });
  return await computeSha256FromText(payload);
}

async function computeSha256FromText(input: string): Promise<string> {
  const encoder = new TextEncoder();
  return await computeSha256FromBytes(encoder.encode(input));
}

async function computeSha256FromBytes(input: ArrayBuffer | Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const source = input instanceof Uint8Array ? input : new Uint8Array(input);
    const bytes = source.byteOffset === 0 && source.byteLength === source.buffer.byteLength ? source.buffer : source.slice().buffer;
    const digest = await crypto.subtle.digest('SHA-256', bytes as ArrayBuffer);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  }

  let fallbackHash = 0;
  const source = input instanceof Uint8Array ? input : new Uint8Array(input);
  for (const byte of source) {
    fallbackHash = (fallbackHash * 31 + byte) >>> 0;
  }
  return fallbackHash.toString(16).padStart(8, '0');
}

async function logAuditEvent(entityType: AuditEventEntity['entityType'], entityId: number, action: string, actor: string, summary: string): Promise<void> {
  if (!Number.isFinite(entityId) || entityId <= 0) {
    return;
  }
  const utcTimestamp = new Date().toISOString();
  const role = loadSitePreferences().activeUserRole;
  const deviceId = getOrCreateDeviceId();
  const allForEntity = await db.auditEvents.toArray();
  const sequence = allForEntity.filter((event) => event.entityType === entityType && event.entityId === entityId).length + 1;
  await db.auditEvents.add({
    timestamp: utcTimestamp,
    utcTimestamp,
    localTimestamp: formatLocalTimestamp(utcTimestamp),
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    sequence,
    role,
    deviceId,
    entityType,
    entityId,
    action,
    actor: `${(actor.trim() || 'local-user')} [${role}@${deviceId}]`,
    summary
  });
}

async function markSignatureStaleIfChanged(jobId: number, changeSummary: string): Promise<void> {
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return;
  }
  const signature = (await db.signatures.where('jobId').equals(jobId).toArray())[0];
  const job = await db.jobs.get(jobId);
  if (!signature || !job) {
    return;
  }
  const latestHash = await computeJobSnapshotHash(jobId);
  if (latestHash === signature.jobSnapshotHash) {
    return;
  }
  if (job.configValues?.signatureInvalidatedAt) {
    return;
  }

  const invalidatedAt = new Date().toISOString();
  await db.transaction('rw', db.jobs, async () => {
    const latestJob = await db.jobs.get(jobId);
    if (!latestJob) {
      return;
    }
    if (latestJob.configValues?.signatureInvalidatedAt) {
      return;
    }
    await db.jobs.put({
      ...latestJob,
      id: jobId,
      configValues: {
        ...(latestJob.configValues ?? {}),
        signatureInvalidatedAt: invalidatedAt,
        signatureInvalidationReason: changeSummary
      }
    });
  });
  await logAuditEvent('signature', jobId, 'signature.invalidated', 'local-user', `Signature snapshot mismatch after ${changeSummary}`);
}

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }
  const key = 'loopvault.deviceId.v1';
  const existing = window.localStorage.getItem(key);
  if (existing && existing.trim().length > 0) {
    return existing;
  }
  const created = `dev-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(key, created);
  return created;
}

function formatLocalTimestamp(utcIso: string): string {
  const date = new Date(utcIso);
  if (!Number.isFinite(date.getTime())) {
    return utcIso;
  }
  return `${date.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'})`;
}

function countWords(input: string): number {
  return input
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export async function updateStep(stepId: number, patch: Partial<StepEntity>): Promise<void> {
  const current = await db.steps.get(stepId);
  if (!current) {
    return;
  }
  await db.steps.put({ ...current, ...patch, id: stepId });
  await markSignatureStaleIfChanged(current.jobId, 'step update');
  await logAuditEvent('step', stepId, 'step.updated', 'local-user', `Updated step fields: ${Object.keys(patch).join(', ')}`);
}

export async function completeJob(jobId: number): Promise<void> {
  const existing = await db.jobs.get(jobId);
  if (!existing) {
    return;
  }
  const completedAt = new Date().toISOString();
  const completionSnapshotHash = await computeJobSnapshotHash(jobId);
  await db.transaction('rw', db.jobs, async () => {
    const job = await db.jobs.get(jobId);
    if (!job) {
      return;
    }
    await db.jobs.put({
      ...job,
      id: jobId,
      status: 'completed',
      completedAt,
      postponedUntil: undefined,
      configValues: {
        ...(job.configValues ?? {}),
        completionSnapshotHash,
        completionUtc: completedAt,
        completionLocal: formatLocalTimestamp(completedAt)
      }
    });
  });
  await logAuditEvent('job', jobId, 'job.completed', existing.techName, 'Marked job as completed');
}

export async function reopenCompletedJob(jobId: number, options: ReopenCompletedJobOptions): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) {
    return;
  }
  if (job.status !== 'completed') {
    throw new Error('Only completed jobs can be reopened.');
  }
  if (options.approverRole !== 'lead' && options.approverRole !== 'admin') {
    throw new Error('Only Lead or Admin can approve reopen.');
  }
  if (countWords(options.reason) < 5) {
    throw new Error('Reopen reason must be at least 5 words.');
  }

  await db.transaction('rw', db.jobs, async () => {
    const latestJob = await db.jobs.get(jobId);
    if (!latestJob) {
      return;
    }
    await db.jobs.put({
      ...latestJob,
      id: jobId,
      status: 'in-progress',
      completedAt: undefined,
      configValues: {
        ...(latestJob.configValues ?? {}),
        reopenedAtUtc: new Date().toISOString(),
        reopenedBy: options.approverName.trim() || 'Unassigned',
        reopenedRole: options.approverRole,
        reopenedReason: options.reason.trim()
      }
    });
  });

  await logAuditEvent('job', jobId, 'job.reopened', options.approverName, `Completed job reopened by ${options.approverRole}. Reason: ${options.reason.trim()}`);
}

export async function addTagDocument(document: TagDocumentEntity): Promise<number> {
  const id = await db.documents.add(document);
  await logAuditEvent('document', document.tagId, 'document.added', document.uploadedBy, `Uploaded document ${document.name}`);
  return id;
}

export async function listTagDocuments(tagId: number): Promise<TagDocumentEntity[]> {
  const rows = await db.documents.where('tagId').equals(tagId).toArray();
  return rows.sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
}

export async function deleteTagDocument(documentId: number): Promise<void> {
  const rows = await db.documents.toArray();
  const deleted = rows.find((row) => row.id === documentId);
  const remaining = rows.filter((row) => row.id !== documentId);
  await db.transaction('rw', db.documents, async () => {
    await db.documents.clear();
    if (remaining.length > 0) {
      await db.documents.bulkPut(remaining);
    }
  });
  if (deleted) {
    await logAuditEvent('document', deleted.tagId, 'document.deleted', 'local-user', `Deleted document ${deleted.name}`);
  }
}

export async function getDocumentUsage(tagId: number): Promise<DocumentUsageSummary> {
  const [allDocuments, tagDocuments] = await Promise.all([db.documents.toArray(), db.documents.where('tagId').equals(tagId).toArray()]);
  const totalBytes = allDocuments.reduce((sum, document) => sum + (document.size || 0), 0);
  const tagBytes = tagDocuments.reduce((sum, document) => sum + (document.size || 0), 0);

  return {
    totalCount: allDocuments.length,
    totalBytes,
    tagCount: tagDocuments.length,
    tagBytes
  };
}

export async function deleteTagWithCascade(tagId: number, options: DeleteTagOptions): Promise<void> {
  const tag = await db.tags.get(tagId);
  if (!tag) {
    return;
  }

  const jobs = await db.jobs.where('tagId').equals(tagId).toArray();
  const jobIds = jobs.map((job) => job.id).filter((id): id is number => typeof id === 'number');
  const steps = await db.steps.toArray();
  const targetSteps = steps.filter((step) => jobIds.includes(step.jobId));
  const stepIds = targetSteps.map((step) => step.id).filter((id): id is number => typeof id === 'number');

  const [allTags, allJobs, allEvidence, allSignatures, allDocuments] = await Promise.all([
    db.tags.toArray(),
    db.jobs.toArray(),
    db.evidence.toArray(),
    db.signatures.toArray(),
    db.documents.toArray()
  ]);

  const remainingTags = allTags.filter((row) => row.id !== tagId);
  const remainingJobs = allJobs.filter((row) => !jobIds.includes(row.id ?? -1));
  const remainingSteps = steps.filter((row) => !jobIds.includes(row.jobId));
  const remainingEvidence = allEvidence.filter((row) => !stepIds.includes(row.stepId));
  const remainingSignatures = allSignatures.filter((row) => !jobIds.includes(row.jobId));
  const remainingDocuments = allDocuments.filter((row) => row.tagId !== tagId);

  let signatureHash = '';
  if (options.signedAuthorization?.signatureBlob) {
    signatureHash = await computeBlobSha256(options.signedAuthorization.signatureBlob);
  }
  const utcTimestamp = new Date().toISOString();
  const role = loadSitePreferences().activeUserRole;
  const deviceId = getOrCreateDeviceId();
  const existingTagEvents = (await db.auditEvents.toArray()).filter((event) => event.entityType === 'tag' && event.entityId === tagId).length;

  await db.transaction('rw', db.tags, db.jobs, db.steps, db.evidence, db.signatures, db.documents, db.auditEvents, async () => {
    await db.tags.clear();
    await db.jobs.clear();
    await db.steps.clear();
    await db.evidence.clear();
    await db.signatures.clear();
    await db.documents.clear();

    if (remainingTags.length > 0) {
      await db.tags.bulkPut(remainingTags);
    }
    if (remainingJobs.length > 0) {
      await db.jobs.bulkPut(remainingJobs);
    }
    if (remainingSteps.length > 0) {
      await db.steps.bulkPut(remainingSteps);
    }
    if (remainingEvidence.length > 0) {
      await db.evidence.bulkPut(remainingEvidence);
    }
    if (remainingSignatures.length > 0) {
      await db.signatures.bulkPut(remainingSignatures);
    }
    if (remainingDocuments.length > 0) {
      await db.documents.bulkPut(remainingDocuments);
    }

    await db.auditEvents.add({
      timestamp: utcTimestamp,
      utcTimestamp,
      localTimestamp: formatLocalTimestamp(utcTimestamp),
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      sequence: existingTagEvents + 1,
      role,
      deviceId,
      entityType: 'tag',
      entityId: tagId,
      action: 'tag.deleted',
      actor: `${(options.requestedBy.trim() || 'local-user')} [${role}@${deviceId}]`,
      summary: `Deleted tag ${tag.tagNumber}. Reason: ${options.reason.trim() || 'No reason provided.'}${options.signedAuthorization ? ` Signed by ${options.signedAuthorization.signer} (hash ${signatureHash.slice(0, 12)})` : ''}`
    });
  });
}

export async function purgeAllData(requestedBy: string, reason: string): Promise<void> {
  const utcTimestamp = new Date().toISOString();
  const role = loadSitePreferences().activeUserRole;
  const deviceId = getOrCreateDeviceId();
  await db.transaction('rw', db.tags, db.jobs, db.steps, db.evidence, db.signatures, db.documents, db.auditEvents, async () => {
    await db.tags.clear();
    await db.jobs.clear();
    await db.steps.clear();
    await db.evidence.clear();
    await db.signatures.clear();
    await db.documents.clear();
    await db.auditEvents.clear();

    await db.auditEvents.add({
      timestamp: utcTimestamp,
      utcTimestamp,
      localTimestamp: formatLocalTimestamp(utcTimestamp),
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      sequence: 1,
      role,
      deviceId,
      entityType: 'system',
      entityId: 1,
      action: 'system.purged',
      actor: `${(requestedBy.trim() || 'local-user')} [${role}@${deviceId}]`,
      summary: `Global purge executed. Reason: ${reason.trim() || 'No reason provided.'}`
    });
  });
}

export async function suspendJob(jobId: number, postponedUntil?: string, lifecycleNotes?: string): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) {
    return;
  }
  await db.jobs.put({
    ...job,
    id: jobId,
    status: 'suspended',
    postponedUntil: postponedUntil?.trim() || undefined,
    lifecycleNotes: lifecycleNotes?.trim() || '',
    completedAt: undefined
  });
  await logAuditEvent('job', jobId, 'job.suspended', job.techName, 'Suspended in-progress job');
}

export async function cancelJob(jobId: number, lifecycleNotes?: string): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) {
    return;
  }
  await db.jobs.put({
    ...job,
    id: jobId,
    status: 'cancelled',
    lifecycleNotes: lifecycleNotes?.trim() || '',
    postponedUntil: undefined,
    completedAt: undefined
  });
  await logAuditEvent('job', jobId, 'job.cancelled', job.techName, 'Cancelled job');
}

export async function resumeJob(jobId: number): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) {
    return;
  }
  await db.jobs.put({
    ...job,
    id: jobId,
    status: 'in-progress',
    postponedUntil: undefined
  });
  await logAuditEvent('job', jobId, 'job.resumed', job.techName, 'Resumed job');
}

export async function repairJobRecords(): Promise<{ repairedJobs: number; repairedSteps: number }> {
  const [jobs, steps] = await Promise.all([db.jobs.toArray(), db.steps.toArray()]);

  let repairedJobs = 0;
  const normalizedJobs: JobEntity[] = [];
  (jobs as unknown[]).forEach((rawJob) => {
    if (!rawJob || typeof rawJob !== 'object') {
      return;
    }
    const job = rawJob as Partial<JobEntity>;
    if (typeof job.id !== 'number') {
      return;
    }

    const normalized: JobEntity = {
      ...job,
      id: job.id,
      tagId: typeof job.tagId === 'number' ? job.tagId : 0,
      jobType: job.jobType === 'calibration' || job.jobType === 'loop-check' ? job.jobType : 'loop-check',
      status: job.status === 'in-progress' || job.status === 'suspended' || job.status === 'cancelled' || job.status === 'completed' ? job.status : 'in-progress',
      techName: String(job.techName ?? ''),
      configValues: normalizeConfigValues(job.configValues),
      postponedUntil: typeof job.postponedUntil === 'string' ? job.postponedUntil : undefined,
      lifecycleNotes: typeof job.lifecycleNotes === 'string' ? job.lifecycleNotes : '',
      completedAt: typeof job.completedAt === 'string' ? job.completedAt : undefined
    };

    const changed =
      normalized.status !== job.status ||
      normalized.tagId !== job.tagId ||
      normalized.jobType !== job.jobType ||
      normalized.techName !== job.techName ||
      JSON.stringify(normalized.configValues ?? {}) !== JSON.stringify(job.configValues ?? {}) ||
      normalized.postponedUntil !== job.postponedUntil ||
      normalized.lifecycleNotes !== job.lifecycleNotes ||
      normalized.completedAt !== job.completedAt;

    if (changed) {
      repairedJobs += 1;
      normalizedJobs.push(normalized);
    }
  });

  let repairedSteps = 0;
  const normalizedSteps: StepEntity[] = [];
  (steps as unknown[]).forEach((rawStep, index) => {
    if (!rawStep || typeof rawStep !== 'object') {
      return;
    }
    const step = rawStep as Partial<StepEntity>;
    if (typeof step.id !== 'number' || typeof step.jobId !== 'number') {
      return;
    }

    const inputType: StepEntity['inputType'] =
      step.inputType === 'passfail' || step.inputType === 'number' || step.inputType === 'text' ? step.inputType : 'text';
    const normalizedPassFail: StepEntity['passFail'] =
      step.passFail === 'pass' || step.passFail === 'fail' || step.passFail === 'na' ? step.passFail : '';

    const normalized: StepEntity = {
      ...step,
      id: step.id,
      jobId: step.jobId,
      templateStepId: String(step.templateStepId ?? `STEP-${index + 1}`),
      title: String(step.title ?? `Step ${index + 1}`),
      inputType,
      unit: typeof step.unit === 'string' ? step.unit : undefined,
      passFail: normalizedPassFail,
      valueNumber: typeof step.valueNumber === 'number' && Number.isFinite(step.valueNumber) ? step.valueNumber : undefined,
      valueText: typeof step.valueText === 'string' ? step.valueText : ''
    };

    const changed =
      normalized.templateStepId !== step.templateStepId ||
      normalized.title !== step.title ||
      normalized.inputType !== step.inputType ||
      normalized.unit !== step.unit ||
      normalized.passFail !== step.passFail ||
      normalized.valueNumber !== step.valueNumber ||
      normalized.valueText !== step.valueText;

    if (changed) {
      repairedSteps += 1;
      normalizedSteps.push(normalized);
    }
  });

  if (normalizedJobs.length > 0 || normalizedSteps.length > 0) {
    await db.transaction('rw', db.jobs, db.steps, async () => {
      if (normalizedJobs.length > 0) {
        await db.jobs.bulkPut(normalizedJobs);
      }
      if (normalizedSteps.length > 0) {
        await db.steps.bulkPut(normalizedSteps);
      }
    });
  }

  return { repairedJobs, repairedSteps };
}

export async function getTableCounts(): Promise<Record<'tags' | 'jobs' | 'steps' | 'evidence' | 'signatures' | 'documents', number>> {
  const [tags, jobs, steps, evidence, signatures, documents] = await Promise.all([
    db.tags.count(),
    db.jobs.count(),
    db.steps.count(),
    db.evidence.count(),
    db.signatures.count(),
    db.documents.count()
  ]);

  return { tags, jobs, steps, evidence, signatures, documents };
}

export async function seedTestData(): Promise<void> {
  const tagId = await db.tags.add({
    tagNumber: `TAG-${Date.now()}`,
    type: 'TAG',
    plant: 'Plant-A',
    instrumentRole: 'Control',
    safetyLayer: 'SIS',
    votingLogic: '2oo3',
    controlSystem: 'DCS',
    silTarget: 'SIL2',
    proofTestInterval: '12 months',
    bypassPermitRequired: 'Yes',
    functionalOwner: 'Instrumentation',
    description: 'Dummy transmitter',
    area: 'A1',
    unit: 'U1',
    service: 'Calibration',
    lrv: '0',
    urv: '100',
    engUnit: 'psi',
    transferFunction: '4-20mA linear',
    failSafe: 'Upscale',
    maxError: '0.1%',
    testEquipment: 'Fluke 754',
    testEquipmentCalDate: '2026-12-31'
  });

  const jobId = await db.jobs.add({
    tagId,
    jobType: 'calibration',
    status: 'in-progress',
    techName: 'Tech Demo'
  });

  const points = [4, 8, 12, 16, 20];
  await db.steps.bulkAdd(
    points.map((point, index) => ({
      jobId,
      templateStepId: `CAL-${index + 1}`,
      title: `Calibration Point ${point}mA`,
      inputType: 'number' as const,
      unit: 'mA',
      passFail: '',
      valueText: ''
    }))
  );
}
