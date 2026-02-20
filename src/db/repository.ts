import type { TemplateStep } from '../templates';
import { db } from './schema';

export interface TagEntity {
  id?: number;
  tagNumber: string;
  description: string;
  area: string;
  unit: string;
  service: string;
}

export interface JobEntity {
  id?: number;
  tagId: number;
  jobType: 'loop-check' | 'calibration';
  status: 'in-progress' | 'completed';
  techName: string;
  completedAt?: string;
}

export interface StepEntity {
  id?: number;
  jobId: number;
  templateStepId: string;
  title: string;
  inputType: 'passfail' | 'number' | 'text';
  unit?: string;
  passFail: 'pass' | 'fail' | '';
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

export async function upsertTagsBulk(tags: TagEntity[]): Promise<void> {
  if (tags.length === 0) {
    return;
  }
  await db.transaction('rw', db.tags, async () => {
    await db.tags.bulkPut(tags);
  });
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
  return await db.evidence.add(evidence);
}

export async function createJobFromTemplate(tagId: number, jobType: JobEntity['jobType'], templateSteps: TemplateStep[]): Promise<number> {
  const jobId = await db.jobs.add({
    tagId,
    jobType,
    status: 'in-progress',
    techName: 'Unassigned'
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

  return jobId;
}


export async function saveSignature(jobId: number, signedBy: string, file: Blob): Promise<void> {
  const existing = (await db.signatures.where('jobId').equals(jobId).toArray())[0];
  if (existing && typeof existing.id === 'number') {
    await db.signatures.put({ ...existing, id: existing.id, signedBy, file, jobId });
  } else {
    await db.signatures.add({ jobId, signedBy, file });
  }
}

export async function getSignatureByJob(jobId: number): Promise<SignatureEntity | null> {
  const signature = (await db.signatures.where('jobId').equals(jobId).toArray())[0];
  return signature ?? null;
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
  const steps = await db.steps.where('jobId').equals(job.id).toArray();
  return { job, tag, steps };
}

export async function updateStep(stepId: number, patch: Partial<StepEntity>): Promise<void> {
  const current = await db.steps.get(stepId);
  if (!current) {
    return;
  }
  await db.steps.put({ ...current, ...patch, id: stepId });
}

export async function completeJob(jobId: number): Promise<void> {
  const job = await db.jobs.get(jobId);
  if (!job) {
    return;
  }
  await db.jobs.put({ ...job, id: jobId, status: 'completed', completedAt: new Date().toISOString() });
}

export async function getTableCounts(): Promise<Record<'tags' | 'jobs' | 'steps' | 'evidence' | 'signatures', number>> {
  const [tags, jobs, steps, evidence, signatures] = await Promise.all([
    db.tags.count(),
    db.jobs.count(),
    db.steps.count(),
    db.evidence.count(),
    db.signatures.count()
  ]);

  return { tags, jobs, steps, evidence, signatures };
}

export async function seedTestData(): Promise<void> {
  const tagId = await db.tags.add({
    tagNumber: `TAG-${Date.now()}`,
    description: 'Dummy transmitter',
    area: 'A1',
    unit: 'U1',
    service: 'Calibration'
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
