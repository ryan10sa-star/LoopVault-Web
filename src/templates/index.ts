import type { JobEntity } from '../db';

export type StepInputType = 'passfail' | 'number' | 'text';

export interface TemplateStep {
  templateStepId: string;
  title: string;
  inputType: StepInputType;
  unit?: string;
}

export interface TemplateConfigField {
  id: string;
  label: string;
  type: 'text' | 'date' | 'select';
  options?: string[];
}

export interface JobTemplate {
  templateId: string;
  jobType: JobEntity['jobType'];
  name: string;
  configFields?: TemplateConfigField[];
  steps: TemplateStep[];
}

interface RawTemplateStep {
  templateStepId?: string;
  id?: string;
  title?: string;
  inputType?: string;
  unit?: string;
}

interface RawTemplateConfigField {
  id?: string;
  label?: string;
  type?: string;
  options?: string[];
}

interface RawJobTemplate {
  templateId?: string;
  id?: string;
  jobType?: JobEntity['jobType'];
  name?: string;
  title?: string;
  configFields?: RawTemplateConfigField[];
  steps?: RawTemplateStep[];
}

const LOOP_CHECK_FALLBACK: JobTemplate = {
  templateId: 'loop_check_basic',
  jobType: 'loop-check',
  name: 'Loop Check Basic',
  steps: [
    { templateStepId: 'LC-1', title: 'Visual Inspection', inputType: 'passfail' },
    { templateStepId: 'LC-2', title: 'Continuity', inputType: 'passfail' },
    { templateStepId: 'LC-3', title: 'Signal Verification', inputType: 'number', unit: 'mA' }
  ]
};

const CALIBRATION_FALLBACK: JobTemplate = {
  templateId: 'calibration_4_20mA_basic',
  jobType: 'calibration',
  name: 'Calibration 4-20mA Basic',
  configFields: [
    {
      id: 'calibrationContext',
      label: 'Calibration Context',
      type: 'select',
      options: ['Maintenance / T-A (In Field)', 'New Construction (Field Mounted)', 'Right Out Of Box (Bench)', 'Commissioning (New Install)']
    },
    {
      id: 'calibrationDataMode',
      label: 'Data Entry Mode',
      type: 'select',
      options: ['As Found + As Left', 'Single Pass']
    },
    {
      id: 'dpSquareRootLocation',
      label: 'DP Flow Square-Root Extraction',
      type: 'select',
      options: ['Not Applicable', 'In Transmitter', 'In Control System (Board)', 'External Extractor (Legacy)']
    },
    { id: 'testEquipment', label: 'Test Equipment (Make/Model/SN)', type: 'text' },
    { id: 'testEquipmentCalDate', label: 'Test Equip Cal Due Date', type: 'date' }
  ],
  steps: [
    { templateStepId: 'CAL-INSP-1', title: 'Inspection: Nameplate and Tag Verified', inputType: 'passfail' },
    { templateStepId: 'CAL-INSP-2', title: 'Inspection: Installation and Impulse/Process Connections Verified', inputType: 'passfail' },
    { templateStepId: 'CAL-INSP-3', title: 'Inspection: Wiring/Termination and Shielding Verified', inputType: 'passfail' },
    { templateStepId: 'CAL-4', title: '4mA Check', inputType: 'number', unit: 'mA' },
    { templateStepId: 'CAL-8', title: '8mA Check', inputType: 'number', unit: 'mA' },
    { templateStepId: 'CAL-12', title: '12mA Check', inputType: 'number', unit: 'mA' },
    { templateStepId: 'CAL-16', title: '16mA Check', inputType: 'number', unit: 'mA' },
    { templateStepId: 'CAL-20', title: '20mA Check', inputType: 'number', unit: 'mA' }
  ]
};

export async function loadTemplate(jobType: JobEntity['jobType']): Promise<JobTemplate> {
  const path = jobType === 'loop-check' ? new URL('./loop_check_basic.json', import.meta.url).href : new URL('./calibration_4_20mA_basic.json', import.meta.url).href;
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Template request failed.');
    }
    const parsed = (await response.json()) as RawJobTemplate;
    return normalizeTemplate(parsed, jobType);
  } catch {
    return jobType === 'loop-check' ? LOOP_CHECK_FALLBACK : CALIBRATION_FALLBACK;
  }
}

function normalizeTemplate(raw: RawJobTemplate, requestedJobType: JobEntity['jobType']): JobTemplate {
  const templateId = raw.templateId ?? raw.id ?? (requestedJobType === 'loop-check' ? 'loop_check_basic' : 'calibration_4_20mA_basic');
  const jobType = raw.jobType ?? inferJobType(templateId) ?? requestedJobType;
  const name = raw.name ?? raw.title ?? templateId;
  const configFields = (raw.configFields ?? []).flatMap((field) => {
    if (!field.id || !field.label) {
      return [];
    }
    const normalizedType: TemplateConfigField['type'] = field.type === 'date' || field.type === 'select' ? field.type : 'text';
    return [
      {
        id: field.id,
        label: field.label,
        type: normalizedType,
        options: normalizedType === 'select' ? field.options ?? [] : undefined
      }
    ];
  });

  const steps = (raw.steps ?? []).flatMap((step, index) => {
    const templateStepId = step.templateStepId ?? step.id ?? `STEP-${index + 1}`;
    const title = step.title ?? `Step ${index + 1}`;
    return [
      {
        templateStepId,
        title,
        inputType: normalizeStepInputType(step.inputType),
        unit: step.unit
      }
    ];
  });

  return {
    templateId,
    jobType,
    name,
    configFields,
    steps
  };
}

function normalizeStepInputType(inputType?: string): StepInputType {
  if (inputType === 'passfail') {
    return 'passfail';
  }
  if (inputType === 'number') {
    return 'number';
  }
  if (inputType === 'textarea' || inputType === 'text') {
    return 'text';
  }
  return 'text';
}

function inferJobType(templateId: string): JobEntity['jobType'] | null {
  if (templateId.includes('loop')) {
    return 'loop-check';
  }
  if (templateId.includes('calibration')) {
    return 'calibration';
  }
  return null;
}
