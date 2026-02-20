import Dexie, { type Table } from 'dexie';
import type { EvidenceEntity, JobEntity, SignatureEntity, StepEntity, TagEntity } from './repository';

export class LoopVaultDb extends Dexie {
  tags!: Table<TagEntity, number>;
  jobs!: Table<JobEntity, number>;
  steps!: Table<StepEntity, number>;
  evidence!: Table<EvidenceEntity, number>;
  signatures!: Table<SignatureEntity, number>;

  public constructor() {
    super('loopvault-db');
    this.version(2).stores({
      tags: '++id, &tagNumber, description, area, unit, service',
      jobs: '++id, tagId, jobType, status, techName, completedAt',
      steps: '++id, jobId, templateStepId, title, inputType, passFail',
      evidence: '++id, stepId, type',
      signatures: '++id, jobId'
    });
  }
}

export const db = new LoopVaultDb();
