import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { db } from '../db';
import type { EvidenceEntity, JobEntity, SignatureEntity, StepEntity, TagEntity } from '../db';

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
  if (!dataFolder || !evidenceFolder) {
    throw new Error('Failed to prepare backup archive structure.');
  }

  const [tags, jobs, steps, evidence, signatures] = await Promise.all([
    db.tags.toArray(),
    db.jobs.toArray(),
    db.steps.toArray(),
    db.evidence.toArray(),
    db.signatures.toArray()
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
      blobPath: `evidence/${filename}`
    });
  }

  dataFolder.file('manifest.json', JSON.stringify({ createdAt: new Date().toISOString(), version: 1 } as BackupManifest, null, 2));
  dataFolder.file('tags.json', JSON.stringify(tags, null, 2));
  dataFolder.file('jobs.json', JSON.stringify(jobs, null, 2));
  dataFolder.file('steps.json', JSON.stringify(steps, null, 2));
  dataFolder.file('evidence.json', JSON.stringify(serializedEvidence, null, 2));
  dataFolder.file('signatures.json', JSON.stringify(serializedSignatures, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `LoopVault_Backup_${date}.zip`);
}

export async function importBackupZip(file: File): Promise<void> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const [tagsText, jobsText, stepsText, evidenceText, signaturesText] = await Promise.all([
    zip.file('data/tags.json')?.async('string'),
    zip.file('data/jobs.json')?.async('string'),
    zip.file('data/steps.json')?.async('string'),
    zip.file('data/evidence.json')?.async('string'),
    zip.file('data/signatures.json')?.async('string')
  ]);

  if (!tagsText || !jobsText || !stepsText || !evidenceText || !signaturesText) {
    throw new Error('Backup is missing one or more required data files.');
  }

  const tags = JSON.parse(tagsText) as TagEntity[];
  const jobs = JSON.parse(jobsText) as JobEntity[];
  const steps = JSON.parse(stepsText) as StepEntity[];
  const serializedEvidence = JSON.parse(evidenceText) as SerializedEvidence[];
  const serializedSignatures = JSON.parse(signaturesText) as SerializedSignature[];

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
      file: await fileEntry.async('blob')
    });
  }

  await db.transaction('rw', db.tags, async () => {
    await db.tags.clear();
    await db.jobs.clear();
    await db.steps.clear();
    await db.evidence.clear();
    await db.signatures.clear();

    await db.tags.bulkPut(tags);
    await db.jobs.bulkPut(jobs);
    await db.steps.bulkPut(steps);
    await db.evidence.bulkPut(evidence);
    await db.signatures.bulkPut(signatures);
  });
}
