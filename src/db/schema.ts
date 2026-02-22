import Dexie, { type Table, type Transaction } from 'dexie';
import type { AuditEventEntity, EvidenceEntity, JobEntity, SignatureEntity, StepEntity, TagDocumentEntity, TagEntity } from './repository';

export class LoopVaultDb extends Dexie {
  tags!: Table<TagEntity, number>;
  jobs!: Table<JobEntity, number>;
  steps!: Table<StepEntity, number>;
  evidence!: Table<EvidenceEntity, number>;
  signatures!: Table<SignatureEntity, number>;
  documents!: Table<TagDocumentEntity, number>;
  auditEvents!: Table<AuditEventEntity, number>;

  public constructor() {
    super('loopvault-db');
    this.version(2).stores({
      tags: '++id, &tagNumber, description, area, unit, service',
      jobs: '++id, tagId, jobType, status, techName, completedAt',
      steps: '++id, jobId, templateStepId, title, inputType, passFail',
      evidence: '++id, stepId, type',
      signatures: '++id, jobId'
    });
    const version3 = this.version(3);
    version3.stores({
      tags: '++id, &tagNumber, description, area, unit, service, lrv, urv, engUnit, transferFunction, failSafe, maxError, testEquipment',
      jobs: '++id, tagId, jobType, status, techName, completedAt',
      steps: '++id, jobId, templateStepId, title, inputType, passFail',
      evidence: '++id, stepId, type',
      signatures: '++id, jobId'
    });
    version3.upgrade(async (tx: Transaction) => {
      await tx
        .table('tags')
        .toCollection()
        .modify((tag: Record<string, unknown>) => {
          tag.description = String(tag.description ?? '');
          tag.area = String(tag.area ?? '');
          tag.unit = String(tag.unit ?? '');
          tag.service = String(tag.service ?? '');
          tag.lrv = String(tag.lrv ?? '');
          tag.urv = String(tag.urv ?? '');
          tag.engUnit = String(tag.engUnit ?? '');
          tag.transferFunction = String(tag.transferFunction ?? '');
          tag.failSafe = String(tag.failSafe ?? '');
          tag.maxError = String(tag.maxError ?? '');
          tag.testEquipment = String(tag.testEquipment ?? '');
        });
    });

    const version4 = this.version(4);
    version4.stores({
      tags: '++id, &tagNumber, description, area, unit, service, lrv, urv, engUnit, transferFunction, failSafe, maxError, testEquipment, testEquipmentCalDate',
      jobs: '++id, tagId, jobType, status, techName, completedAt',
      steps: '++id, jobId, templateStepId, title, inputType, passFail',
      evidence: '++id, stepId, type',
      signatures: '++id, jobId'
    });
    version4.upgrade(async (tx: Transaction) => {
      await tx
        .table('tags')
        .toCollection()
        .modify((tag: Record<string, unknown>) => {
          tag.testEquipmentCalDate = String(tag.testEquipmentCalDate ?? '');
        });
    });

    const version5 = this.version(5);
    version5.stores({
      tags: '++id, &tagNumber, plant, description, area, unit, service, lrv, urv, engUnit, transferFunction, failSafe, maxError, testEquipment, testEquipmentCalDate',
      jobs: '++id, tagId, jobType, status, techName, completedAt',
      steps: '++id, jobId, templateStepId, title, inputType, passFail',
      evidence: '++id, stepId, type',
      signatures: '++id, jobId'
    });
    version5.upgrade(async (tx: Transaction) => {
      await tx
        .table('tags')
        .toCollection()
        .modify((tag: Record<string, unknown>) => {
          tag.plant = String(tag.plant ?? '');
        });
    });

    const version6 = this.version(6);
    version6.stores({
      tags: '++id, &tagNumber, type, plant, description, area, unit, service, lrv, urv, engUnit, transferFunction, failSafe, maxError, testEquipment, testEquipmentCalDate',
      jobs: '++id, tagId, jobType, status, techName, completedAt',
      steps: '++id, jobId, templateStepId, title, inputType, passFail',
      evidence: '++id, stepId, type',
      signatures: '++id, jobId'
    });
    version6.upgrade(async (tx: Transaction) => {
      await tx
        .table('tags')
        .toCollection()
        .modify((tag: Record<string, unknown>) => {
          const currentType = String(tag.type ?? '').trim();
          const rawTagNumber = String(tag.tagNumber ?? '').trim();
          const inferredPrefix = rawTagNumber.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? '';
          tag.type = currentType || inferredPrefix;
        });
    });

    const version7 = this.version(7);
    version7.stores({
      tags: '++id, &tagNumber, type, plant, instrumentRole, safetyLayer, votingLogic, controlSystem, description, area, unit, service, lrv, urv, engUnit, transferFunction, failSafe, maxError, testEquipment, testEquipmentCalDate',
      jobs: '++id, tagId, jobType, status, techName, completedAt',
      steps: '++id, jobId, templateStepId, title, inputType, passFail',
      evidence: '++id, stepId, type',
      signatures: '++id, jobId'
    });
    version7.upgrade(async (tx: Transaction) => {
      await tx
        .table('tags')
        .toCollection()
        .modify((tag: Record<string, unknown>) => {
          tag.instrumentRole = String(tag.instrumentRole ?? '');
          tag.safetyLayer = String(tag.safetyLayer ?? '');
          tag.votingLogic = String(tag.votingLogic ?? '');
          tag.controlSystem = String(tag.controlSystem ?? '');
        });
    });

    const version8 = this.version(8);
    version8.stores({
      tags: '++id, &tagNumber, type, plant, instrumentRole, safetyLayer, votingLogic, controlSystem, silTarget, proofTestInterval, bypassPermitRequired, functionalOwner, description, area, unit, service, lrv, urv, engUnit, transferFunction, failSafe, maxError, testEquipment, testEquipmentCalDate',
      jobs: '++id, tagId, jobType, status, techName, completedAt',
      steps: '++id, jobId, templateStepId, title, inputType, passFail',
      evidence: '++id, stepId, type',
      signatures: '++id, jobId'
    });
    version8.upgrade(async (tx: Transaction) => {
      await tx
        .table('tags')
        .toCollection()
        .modify((tag: Record<string, unknown>) => {
          tag.silTarget = String(tag.silTarget ?? '');
          tag.proofTestInterval = String(tag.proofTestInterval ?? '');
          tag.bypassPermitRequired = String(tag.bypassPermitRequired ?? '');
          tag.functionalOwner = String(tag.functionalOwner ?? '');
        });
    });

    this.version(9).stores({
      tags: '++id, &tagNumber, type, plant, instrumentRole, safetyLayer, votingLogic, controlSystem, silTarget, proofTestInterval, bypassPermitRequired, functionalOwner, description, area, unit, service, lrv, urv, engUnit, transferFunction, failSafe, maxError, testEquipment, testEquipmentCalDate',
      jobs: '++id, tagId, jobType, status, techName, completedAt',
      steps: '++id, jobId, templateStepId, title, inputType, passFail',
      evidence: '++id, stepId, type',
      signatures: '++id, jobId',
      documents: '++id, tagId, docType, uploadedAt, uploadedBy, size'
    });

    this.version(10).stores({
      tags: '++id, &tagNumber, type, plant, instrumentRole, safetyLayer, votingLogic, controlSystem, silTarget, proofTestInterval, bypassPermitRequired, functionalOwner, description, area, unit, service, lrv, urv, engUnit, transferFunction, failSafe, maxError, testEquipment, testEquipmentCalDate',
      jobs: '++id, tagId, jobType, status, techName, completedAt',
      steps: '++id, jobId, templateStepId, title, inputType, passFail',
      evidence: '++id, stepId, type',
      signatures: '++id, &jobId, signedAt',
      documents: '++id, tagId, docType, uploadedAt, uploadedBy, size',
      auditEvents: '++id, timestamp, entityType, entityId, action'
    });
  }
}

export const db = new LoopVaultDb();
