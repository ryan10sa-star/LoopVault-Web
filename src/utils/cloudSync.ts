import { db, type AuditEventEntity, type EvidenceEntity, type JobEntity, type SignatureEntity, type StepEntity, type TagDocumentEntity, type TagEntity } from '../db';
import type { CloudSyncSettings } from '../config/cloudSync';

interface SyncSnapshot {
  generatedAt: string;
  schemaVersion: number;
  blobSnapshotId: string;
  blobChunkCount: number;
  tags: TagEntity[];
  jobs: JobEntity[];
  steps: StepEntity[];
  auditEvents: AuditEventEntity[];
  signatures: Array<{ jobId: number; signedBy: string; signedAt: string; signatureHash: string; jobSnapshotHash: string }>;
  evidenceMeta: Array<{ stepId: number; type: string; fileSize: number }>;
  documentsMeta: Array<{ tagId: number; name: string; docType: string; size: number; uploadedAt: string; uploadedBy: string }>;
}

interface SyncRecordResponse {
  payload: SyncSnapshot;
  updated_at: string;
  updated_by: string;
}

interface BlobChunkResponse {
  chunk_index: number;
  payload: BlobChunkPayload;
}

interface BlobChunkPayload {
  signatures: SignatureBlobRecord[];
  evidence: EvidenceBlobRecord[];
  documents: DocumentBlobRecord[];
}

interface SignatureBlobRecord {
  id?: number;
  jobId: number;
  signedBy: string;
  signedAt: string;
  signatureHash: string;
  jobSnapshotHash: string;
  fileMimeType: string;
  fileBase64: string;
}

interface EvidenceBlobRecord {
  id?: number;
  stepId: number;
  type: 'photo';
  fileMimeType: string;
  fileBase64: string;
}

interface DocumentBlobRecord {
  id?: number;
  tagId: number;
  name: string;
  mimeType: string;
  size: number;
  docType: string;
  uploadedAt: string;
  uploadedBy: string;
  fileMimeType: string;
  fileBase64: string;
}

const BLOB_CHUNK_SIZE = 20;

export interface SyncSummary {
  tags: number;
  jobs: number;
  steps: number;
  auditEvents: number;
  signatures: number;
  evidence: number;
  documents: number;
  generatedAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CloudConnectionStatus {
  snapshotsTableReachable: boolean;
  blobChunksTableReachable: boolean;
}

export async function testCloudConnection(settings: CloudSyncSettings): Promise<CloudConnectionStatus> {
  validateSettings(settings);

  const snapshotsResponse = await fetch(`${settings.supabaseUrl}/rest/v1/sync_snapshots?select=site_code&limit=1`, {
    method: 'GET',
    headers: createHeaders(settings.supabaseAnonKey)
  });

  if (!snapshotsResponse.ok) {
    throw new Error(await formatHttpError('Connection test failed for sync_snapshots', snapshotsResponse));
  }

  const blobChunksResponse = await fetch(`${settings.supabaseUrl}/rest/v1/sync_blob_chunks?select=snapshot_id&limit=1`, {
    method: 'GET',
    headers: createHeaders(settings.supabaseAnonKey)
  });

  if (!blobChunksResponse.ok) {
    throw new Error(await formatHttpError('Connection test failed for sync_blob_chunks', blobChunksResponse));
  }

  return {
    snapshotsTableReachable: true,
    blobChunksTableReachable: true
  };
}

export async function pushCloudSnapshot(settings: CloudSyncSettings): Promise<SyncSummary> {
  validateSettings(settings);
  const blobSnapshotId = generateSnapshotId();
  const built = await buildSnapshot(blobSnapshotId);
  await uploadBlobChunks(settings, blobSnapshotId, built.blobChunks);

  const response = await fetch(`${settings.supabaseUrl}/rest/v1/sync_snapshots?on_conflict=site_code`, {
    method: 'POST',
    headers: createHeaders(settings.supabaseAnonKey, {
      Prefer: 'resolution=merge-duplicates,return=minimal'
    }),
    body: JSON.stringify([
      {
        site_code: settings.siteCode,
        payload: built.payload,
        updated_by: settings.operatorName || 'local-user',
        updated_at: new Date().toISOString()
      }
    ])
  });

  if (!response.ok) {
    throw new Error(`Cloud push failed (${response.status}).`);
  }

  return {
    tags: built.payload.tags.length,
    jobs: built.payload.jobs.length,
    steps: built.payload.steps.length,
    auditEvents: built.payload.auditEvents.length,
    signatures: built.payload.signatures.length,
    evidence: built.payload.evidenceMeta.length,
    documents: built.payload.documentsMeta.length,
    generatedAt: built.payload.generatedAt
  };
}

export async function pullCloudSnapshot(settings: CloudSyncSettings): Promise<SyncSummary> {
  validateSettings(settings);
  const encodedSiteCode = encodeURIComponent(settings.siteCode);
  const response = await fetch(
    `${settings.supabaseUrl}/rest/v1/sync_snapshots?site_code=eq.${encodedSiteCode}&select=payload,updated_at,updated_by&limit=1`,
    {
      method: 'GET',
      headers: createHeaders(settings.supabaseAnonKey)
    }
  );

  if (!response.ok) {
    throw new Error(`Cloud pull failed (${response.status}).`);
  }

  const rows = (await response.json()) as SyncRecordResponse[];
  const record = rows[0];
  if (!record?.payload) {
    throw new Error('No cloud snapshot found for this site code.');
  }

  await applySnapshot(record.payload, settings);

  return {
    tags: record.payload.tags.length,
    jobs: record.payload.jobs.length,
    steps: record.payload.steps.length,
    auditEvents: record.payload.auditEvents.length,
    signatures: record.payload.signatures.length,
    evidence: record.payload.evidenceMeta.length,
    documents: record.payload.documentsMeta.length,
    generatedAt: record.payload.generatedAt,
    updatedAt: record.updated_at,
    updatedBy: record.updated_by
  };
}

async function buildSnapshot(blobSnapshotId: string): Promise<{ payload: SyncSnapshot; blobChunks: BlobChunkPayload[] }> {
  const [tags, jobs, steps, auditEvents, signatures, evidence, documents] = await Promise.all([
    db.tags.toArray(),
    db.jobs.toArray(),
    db.steps.toArray(),
    db.auditEvents.toArray(),
    db.signatures.toArray(),
    db.evidence.toArray(),
    db.documents.toArray()
  ]);

  const signatureBlobRecords = await Promise.all(
    signatures
      .filter((item): item is SignatureEntity & { jobId: number } => typeof item.jobId === 'number' && item.file instanceof Blob)
      .map(async (item) => ({
        id: item.id,
        jobId: item.jobId,
        signedBy: String(item.signedBy ?? ''),
        signedAt: String(item.signedAt ?? ''),
        signatureHash: String(item.signatureHash ?? ''),
        jobSnapshotHash: String(item.jobSnapshotHash ?? ''),
        fileMimeType: item.file.type || 'application/octet-stream',
        fileBase64: await blobToBase64(item.file)
      }))
  );

  const evidenceBlobRecords = await Promise.all(
    evidence
      .filter((item): item is EvidenceEntity & { stepId: number } => typeof item.stepId === 'number' && item.file instanceof Blob)
      .map(async (item) => ({
        id: item.id,
        stepId: item.stepId,
        type: 'photo' as const,
        fileMimeType: item.file.type || 'application/octet-stream',
        fileBase64: await blobToBase64(item.file)
      }))
  );

  const documentBlobRecords = await Promise.all(
    documents
      .filter((item): item is TagDocumentEntity & { tagId: number } => typeof item.tagId === 'number' && item.file instanceof Blob)
      .map(async (item) => ({
        id: item.id,
        tagId: item.tagId,
        name: String(item.name ?? ''),
        mimeType: String(item.mimeType ?? ''),
        size: Number(item.size ?? 0),
        docType: String(item.docType ?? ''),
        uploadedAt: String(item.uploadedAt ?? ''),
        uploadedBy: String(item.uploadedBy ?? ''),
        fileMimeType: item.file.type || 'application/octet-stream',
        fileBase64: await blobToBase64(item.file)
      }))
  );

  const blobChunks = chunkBlobPayloads(signatureBlobRecords, evidenceBlobRecords, documentBlobRecords);

  const payload: SyncSnapshot = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 2,
    blobSnapshotId,
    blobChunkCount: blobChunks.length,
    tags,
    jobs,
    steps,
    auditEvents,
    signatures: signatures
      .filter((item): item is typeof item & { jobId: number } => typeof item.jobId === 'number')
      .map((item) => ({
        jobId: item.jobId,
        signedBy: String(item.signedBy ?? ''),
        signedAt: String(item.signedAt ?? ''),
        signatureHash: String(item.signatureHash ?? ''),
        jobSnapshotHash: String(item.jobSnapshotHash ?? '')
      })),
    evidenceMeta: evidence
      .filter((item): item is typeof item & { stepId: number; file: Blob } => typeof item.stepId === 'number' && item.file instanceof Blob)
      .map((item) => ({
        stepId: item.stepId,
        type: String(item.type ?? 'photo'),
        fileSize: item.file.size
      })),
    documentsMeta: documents
      .filter((item): item is typeof item & { tagId: number } => typeof item.tagId === 'number')
      .map((item) => ({
        tagId: item.tagId,
        name: String(item.name ?? ''),
        docType: String(item.docType ?? ''),
        size: Number(item.size ?? 0),
        uploadedAt: String(item.uploadedAt ?? ''),
        uploadedBy: String(item.uploadedBy ?? '')
      }))
  };

  return { payload, blobChunks };
}

async function applySnapshot(snapshot: SyncSnapshot, settings: CloudSyncSettings): Promise<void> {
  const nextTags = Array.isArray(snapshot.tags) ? snapshot.tags : [];
  const nextJobs = Array.isArray(snapshot.jobs) ? snapshot.jobs : [];
  const nextSteps = Array.isArray(snapshot.steps) ? snapshot.steps : [];
  const nextAuditEvents = Array.isArray(snapshot.auditEvents) ? snapshot.auditEvents : [];
  const binaryPayload = await downloadBlobChunks(snapshot, settings);

  await db.transaction('rw', db.tags, db.jobs, db.steps, db.auditEvents, db.signatures, db.evidence, db.documents, async () => {
    await Promise.all([db.tags.clear(), db.jobs.clear(), db.steps.clear(), db.auditEvents.clear(), db.signatures.clear(), db.evidence.clear(), db.documents.clear()]);
    if (nextTags.length > 0) {
      await db.tags.bulkPut(nextTags);
    }
    if (nextJobs.length > 0) {
      await db.jobs.bulkPut(nextJobs);
    }
    if (nextSteps.length > 0) {
      await db.steps.bulkPut(nextSteps);
    }
    if (nextAuditEvents.length > 0) {
      await db.auditEvents.bulkPut(nextAuditEvents);
    }
    if (binaryPayload.signatures.length > 0) {
      await db.signatures.bulkPut(binaryPayload.signatures);
    }
    if (binaryPayload.evidence.length > 0) {
      await db.evidence.bulkPut(binaryPayload.evidence);
    }
    if (binaryPayload.documents.length > 0) {
      await db.documents.bulkPut(binaryPayload.documents);
    }
  });
}

async function uploadBlobChunks(settings: CloudSyncSettings, snapshotId: string, chunks: BlobChunkPayload[]): Promise<void> {
  await fetch(`${settings.supabaseUrl}/rest/v1/sync_blob_chunks?site_code=eq.${encodeURIComponent(settings.siteCode)}`, {
    method: 'DELETE',
    headers: createHeaders(settings.supabaseAnonKey)
  });

  if (chunks.length === 0) {
    return;
  }

  const payloadRows = chunks.map((payload, index) => ({
    site_code: settings.siteCode,
    snapshot_id: snapshotId,
    chunk_index: index,
    total_chunks: chunks.length,
    payload
  }));

  const response = await fetch(`${settings.supabaseUrl}/rest/v1/sync_blob_chunks`, {
    method: 'POST',
    headers: createHeaders(settings.supabaseAnonKey, {
      Prefer: 'return=minimal'
    }),
    body: JSON.stringify(payloadRows)
  });

  if (!response.ok) {
    throw new Error(`Blob chunk upload failed (${response.status}).`);
  }
}

async function downloadBlobChunks(snapshot: SyncSnapshot, settings: CloudSyncSettings): Promise<{ signatures: SignatureEntity[]; evidence: EvidenceEntity[]; documents: TagDocumentEntity[] }> {
  if (!snapshot.blobSnapshotId || snapshot.blobChunkCount <= 0) {
    return { signatures: [], evidence: [], documents: [] };
  }

  const response = await fetch(
    `${settings.supabaseUrl}/rest/v1/sync_blob_chunks?site_code=eq.${encodeURIComponent(settings.siteCode)}&snapshot_id=eq.${encodeURIComponent(snapshot.blobSnapshotId)}&select=chunk_index,payload&order=chunk_index.asc`,
    {
      method: 'GET',
      headers: createHeaders(settings.supabaseAnonKey)
    }
  );

  if (!response.ok) {
    throw new Error(`Blob chunk download failed (${response.status}).`);
  }

  const rows = (await response.json()) as BlobChunkResponse[];
  const mergedSignatures: SignatureBlobRecord[] = [];
  const mergedEvidence: EvidenceBlobRecord[] = [];
  const mergedDocuments: DocumentBlobRecord[] = [];

  rows
    .sort((left, right) => left.chunk_index - right.chunk_index)
    .forEach((row) => {
      const payload = row.payload;
      if (Array.isArray(payload?.signatures)) {
        mergedSignatures.push(...payload.signatures);
      }
      if (Array.isArray(payload?.evidence)) {
        mergedEvidence.push(...payload.evidence);
      }
      if (Array.isArray(payload?.documents)) {
        mergedDocuments.push(...payload.documents);
      }
    });

  const signatures: SignatureEntity[] = mergedSignatures.map((item) => ({
    id: item.id,
    jobId: item.jobId,
    signedBy: item.signedBy,
    signedAt: item.signedAt,
    signatureHash: item.signatureHash,
    jobSnapshotHash: item.jobSnapshotHash,
    file: base64ToBlob(item.fileBase64, item.fileMimeType)
  }));

  const evidence: EvidenceEntity[] = mergedEvidence.map((item) => ({
    id: item.id,
    stepId: item.stepId,
    type: 'photo',
    file: base64ToBlob(item.fileBase64, item.fileMimeType)
  }));

  const documents: TagDocumentEntity[] = mergedDocuments.map((item) => ({
    id: item.id,
    tagId: item.tagId,
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
    docType: item.docType,
    uploadedAt: item.uploadedAt,
    uploadedBy: item.uploadedBy,
    file: base64ToBlob(item.fileBase64, item.fileMimeType)
  }));

  return { signatures, evidence, documents };
}

function chunkBlobPayloads(signatures: SignatureBlobRecord[], evidence: EvidenceBlobRecord[], documents: DocumentBlobRecord[]): BlobChunkPayload[] {
  const signatureChunks = toChunks(signatures, BLOB_CHUNK_SIZE);
  const evidenceChunks = toChunks(evidence, BLOB_CHUNK_SIZE);
  const documentChunks = toChunks(documents, BLOB_CHUNK_SIZE);
  const maxLength = Math.max(signatureChunks.length, evidenceChunks.length, documentChunks.length, 1);

  return Array.from({ length: maxLength }, (_, index) => ({
    signatures: signatureChunks[index] ?? [],
    evidence: evidenceChunks[index] ?? [],
    documents: documentChunks[index] ?? []
  }));
}

function toChunks<T>(items: T[], chunkSize: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const sliceSize = 0x8000;
  for (let index = 0; index < bytes.length; index += sliceSize) {
    const chunk = bytes.subarray(index, index + sliceSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

function generateSnapshotId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}


function validateSettings(settings: CloudSyncSettings): void {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey || !settings.siteCode) {
    throw new Error('Cloud sync requires Supabase URL, anon key, and site code.');
  }
}

function createHeaders(anonKey: string, additional?: Record<string, string>): HeadersInit {
  return {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    ...(additional ?? {})
  };
}

async function formatHttpError(prefix: string, response: Response): Promise<string> {
  const fallback = `${prefix} (${response.status}).`;
  try {
    const payload = (await response.json()) as { message?: string; hint?: string; details?: string };
    const parts = [payload.message, payload.details, payload.hint].filter((value) => String(value ?? '').trim().length > 0);
    return parts.length > 0 ? `${prefix}: ${parts.join(' | ')}` : fallback;
  } catch {
    return fallback;
  }
}