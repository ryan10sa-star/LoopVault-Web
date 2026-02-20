import type { JobEntity } from '../db';

export type StepInputType = 'passfail' | 'number' | 'text';

export interface TemplateStep {
  templateStepId: string;
  title: string;
  inputType: StepInputType;
  unit?: string;
}

export interface JobTemplate {
  templateId: string;
  jobType: JobEntity['jobType'];
  name: string;
  steps: TemplateStep[];
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
  steps: [
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
    const parsed = (await response.json()) as JobTemplate;
    return parsed;
  } catch {
    return jobType === 'loop-check' ? LOOP_CHECK_FALLBACK : CALIBRATION_FALLBACK;
  }
}
