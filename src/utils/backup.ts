import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { db } from '../db';
import type { EvidenceEntity, JobEntity, SignatureEntity, StepEntity, TagDocumentEntity, TagEntity } from '../db';

interface SerializedEvidence {
  id?: number;
  stepId: number;
  type: 'photo';
  blobPath: string;
}

interface SerializedSignature {
  id?: number;
  jobId: number;
  signedBy: string;
  signedAt?: string;
  signatureHash?: string;
  jobSnapshotHash?: string;
  blobPath: string;
}

interface SerializedDocument {
  id?: number;
  tagId: number;
  name: string;
  mimeType: string;
  size: number;
  docType: string;
  uploadedAt: string;
  uploadedBy: string;
  blobPath: string;
}

interface BackupManifest {
  createdAt: string;
  version: 1;
}

export async function exportBackupZip(): Promise<void> {
  const zip = new JSZip();
  const dataFolder = zip.folder('data');
  const evidenceFolder = zip.folder('evidence');
  const documentsFolder = zip.folder('documents');
  if (!dataFolder || !evidenceFolder || !documentsFolder) {
    throw new Error('Failed to prepare backup archive structure.');
  }

  const [tags, jobs, steps, evidence, signatures, documents] = await Promise.all([
    db.tags.toArray(),
    db.jobs.toArray(),
    db.steps.toArray(),
    db.evidence.toArray(),
    db.signatures.toArray(),
    db.documents.toArray()
  ]);

  const serializedEvidence: SerializedEvidence[] = [];
  for (const item of evidence) {
    const filename = `evidence_${item.id}.bin`;
    evidenceFolder.file(filename, item.file);
    serializedEvidence.push({
      id: item.id,
      stepId: item.stepId,
      type: item.type,
      blobPath: `evidence/${filename}`
    });
  }

  const serializedSignatures: SerializedSignature[] = [];
  for (const item of signatures) {
    const filename = `signature_${item.id}.bin`;
    evidenceFolder.file(filename, item.file);
    serializedSignatures.push({
      id: item.id,
      jobId: item.jobId,
      signedBy: item.signedBy,
      signedAt: item.signedAt,
      signatureHash: item.signatureHash,
      jobSnapshotHash: item.jobSnapshotHash,
      blobPath: `evidence/${filename}`
    });
  }

  const serializedDocuments: SerializedDocument[] = [];
  for (const item of documents) {
    const filename = `document_${item.id ?? Date.now()}_${item.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    documentsFolder.file(filename, item.file);
    serializedDocuments.push({
      id: item.id,
      tagId: item.tagId,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      docType: item.docType,
      uploadedAt: item.uploadedAt,
      uploadedBy: item.uploadedBy,
      blobPath: `documents/${filename}`
    });
  }

  dataFolder.file('manifest.json', JSON.stringify({ createdAt: new Date().toISOString(), version: 1 } as BackupManifest, null, 2));
  dataFolder.file('tags.json', JSON.stringify(tags, null, 2));
  dataFolder.file('jobs.json', JSON.stringify(jobs, null, 2));
  dataFolder.file('steps.json', JSON.stringify(steps, null, 2));
  dataFolder.file('evidence.json', JSON.stringify(serializedEvidence, null, 2));
  dataFolder.file('signatures.json', JSON.stringify(serializedSignatures, null, 2));
  dataFolder.file('documents.json', JSON.stringify(serializedDocuments, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `LoopVault_Backup_${date}.zip`);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('loopvault:lastBackupAt', new Date().toISOString());
  }
}

export async function importBackupZip(file: File): Promise<void> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const manifestText = await zip.file('data/manifest.json')?.async('string');
  if (!manifestText) {
    throw new Error('Backup manifest is missing.');
  }
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(manifestText) as BackupManifest;
  } catch {
    throw new Error('Backup manifest is invalid JSON.');
  }
  if (manifest.version !== 1) {
    throw new Error(`Unsupported backup version: ${String(manifest.version ?? 'unknown')}.`);
  }

  const [tagsText, jobsText, stepsText, evidenceText, signaturesText, documentsText] = await Promise.all([
    zip.file('data/tags.json')?.async('string'),
    zip.file('data/jobs.json')?.async('string'),
    zip.file('data/steps.json')?.async('string'),
    zip.file('data/evidence.json')?.async('string'),
    zip.file('data/signatures.json')?.async('string'),
    zip.file('data/documents.json')?.async('string')
  ]);

  if (!tagsText || !jobsText || !stepsText || !evidenceText || !signaturesText) {
    throw new Error('Backup is missing one or more required data files.');
  }

  const tags = JSON.parse(tagsText) as TagEntity[];
  const jobs = JSON.parse(jobsText) as JobEntity[];
  const steps = JSON.parse(stepsText) as StepEntity[];
  const serializedEvidence = JSON.parse(evidenceText) as SerializedEvidence[];
  const serializedSignatures = JSON.parse(signaturesText) as SerializedSignature[];
  const serializedDocuments = documentsText ? (JSON.parse(documentsText) as SerializedDocument[]) : [];

  const evidence: EvidenceEntity[] = [];
  for (const item of serializedEvidence) {
    const fileEntry = zip.file(item.blobPath);
    if (!fileEntry) {
      throw new Error(`Missing evidence blob: ${item.blobPath}`);
    }
    evidence.push({
      id: item.id,
      stepId: item.stepId,
      type: item.type,
      file: await fileEntry.async('blob')
    });
  }

  const signatures: SignatureEntity[] = [];
  for (const item of serializedSignatures) {
    const fileEntry = zip.file(item.blobPath);
    if (!fileEntry) {
      throw new Error(`Missing signature blob: ${item.blobPath}`);
    }
    signatures.push({
      id: item.id,
      jobId: item.jobId,
      signedBy: item.signedBy,
      signedAt: item.signedAt || new Date().toISOString(),
      signatureHash: item.signatureHash || 'imported-legacy-signature',
      jobSnapshotHash: item.jobSnapshotHash || 'imported-legacy-job-snapshot',
      file: await fileEntry.async('blob')
    });
  }

  const documents: TagDocumentEntity[] = [];
  for (const item of serializedDocuments) {
    const fileEntry = zip.file(item.blobPath);
    if (!fileEntry) {
      throw new Error(`Missing document blob: ${item.blobPath}`);
    }
    documents.push({
      id: item.id,
      tagId: item.tagId,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      docType: item.docType,
      uploadedAt: item.uploadedAt,
      uploadedBy: item.uploadedBy,
      file: await fileEntry.async('blob')
    });
  }

  await db.transaction('rw', db.tags, db.jobs, db.steps, db.evidence, db.signatures, db.documents, async () => {
    await db.tags.clear();
    await db.jobs.clear();
    await db.steps.clear();
    await db.evidence.clear();
    await db.signatures.clear();
    await db.documents.clear();

    await db.tags.bulkPut(tags);
    await db.jobs.bulkPut(jobs);
    await db.steps.bulkPut(steps);
    await db.evidence.bulkPut(evidence);
    await db.signatures.bulkPut(signatures);
    await db.documents.bulkPut(documents);
  });
}
