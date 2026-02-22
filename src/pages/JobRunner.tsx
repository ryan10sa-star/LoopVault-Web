import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SignaturePad } from '../components/SignaturePad';
import { StatusChip } from '../components/StatusChip';
import {
  addEvidence,
  cancelJob,
  completeJob,
  db,
  ensureCalibrationInspectionSteps,
  getJobRunnerData,
  getSignatureByJob,
  listEvidenceByJob,
  reopenCompletedJob,
  resumeJob,
  saveSignature,
  suspendJob,
  updateJobConfigValue,
  updateTag,
  updateJobTechName,
  updateStep,
  type StepEntity
} from '../db';
import { MIN_LIFECYCLE_NOTE_WORDS } from '../config/appLimits';
import { DEFAULT_INSPECTION_SUGGESTIONS, loadSitePreferences, SITE_PREFERENCES_UPDATED_EVENT, type InspectionSuggestions } from '../config/sitePreferences';
import { loadTemplate } from '../templates';
import { generateLoopFolderPdf } from '../utils/pdfGenerator';
import { calculateExpectedMilliamp, calculateFivePointInputs, parseNumericInput } from '../utils/calibrationMath';
import { playCelebrationSound, randomCelebrationExclamation } from '../utils/celebration';

const CALIBRATION_MODE_AS_FOUND_LEFT = 'As Found + As Left';
const CALIBRATION_MODE_SINGLE_PASS = 'Single Pass';
const DEFAULT_CALIBRATION_TOLERANCE_PERCENT = 2;
const CALIBRATION_TOLERANCE_PERCENT_OPTIONS = ['0.5', '1', '2', '3', '5', '10'] as const;
const TEST_EQUIPMENT_COMMON_OPTIONS = [
  'Fluke 700',
  'Fluke 701',
  'Fluke 702',
  'Fluke 705',
  'Fluke 707',
  'Fluke 709',
  'Fluke 709H',
  'Fluke 710',
  'Fluke 712',
  'Fluke 714',
  'Fluke 715',
  'Fluke 717',
  'Fluke 718',
  'Fluke 719',
  'Fluke 721',
  'Fluke 724',
  'Fluke 725',
  'Fluke 754',
  'Fluke 726',
  'Fluke 743B',
  'Fluke 744',
  'Fluke 744 Documenting Process Calibrator',
  'Fluke 753',
  'Fluke 754 Documenting Process Calibrator',
  'Fluke 787 ProcessMeter',
  'Fluke 789 ProcessMeter',
  'Fluke 805 FC',
  'Fluke 87V',
  'Fluke 1507',
  'Fluke 1524',
  'Fluke 1620A',
  'Fluke 1630-2 FC',
  'Fluke 1730',
  'Fluke 1750',
  'Fluke 190 Series',
  'Fluke 279 FC',
  'Fluke 289',
  'Fluke 717 100G',
  'Fluke 717 300G',
  'Fluke 717 500G',
  'Fluke 717 1000G',
  'Fluke 717 1500G',
  'Fluke 718 30G',
  'Fluke 718 100G',
  'Fluke 718Ex 100G',
  'Fluke 719Pro 30G',
  'Fluke 719Pro 100G',
  'Fluke 719Pro 300G',
  'Fluke 721 30 psi',
  'Fluke 721 100 psi',
  'Fluke 721 300 psi',
  'Fluke 721 500 psi',
  'Fluke 721 1000 psi',
  'Fluke 726 FC',
  'Fluke 725Ex',
  'Fluke 726Ex',
  'Fluke 729',
  'Fluke 729 FC',
  'Fluke 750P Series Module',
  'Fluke 750R Series Module',
  'Fluke 2700G',
  'Fluke 279 FC Thermal',
  'Fluke 393 FC',
  'Fluke 417D',
  'Fluke 418D',
  'Fluke 922',
  'Fluke 975 AirMeter',
  'Fluke 971',
  'Beamex MC6',
  'Beamex MC6-Ex',
  'Beamex MC6-T',
  'Beamex MC4',
  'Beamex MC2',
  'Beamex MC5',
  'Beamex b24',
  'Beamex CENTRiCAL',
  'Beamex ePG',
  'Beamex POC8',
  'Beamex POC6',
  'Yokogawa CA700',
  'Yokogawa CA150',
  'Yokogawa CA71',
  'Yokogawa CA51',
  'Yokogawa MT300',
  'Yokogawa AQ7280',
  'Druck DPI 620 Genii',
  'Druck DPI 611',
  'Druck DPI 612',
  'Druck DPI 705E',
  'Druck UPS4E',
  'Druck UPS2',
  'Druck DPI 800/802',
  'Druck PV212',
  'Druck PV411A',
  'Druck PV621G',
  'Meriam MFC 5150',
  'Meriam MFC 4100',
  'Meriam MFC 5150X',
  'Meriam MFC 5150 HART',
  'Meriam M2',
  'Meriam M4',
  'Meriam M100',
  'Meriam M140',
  'Additel 223A',
  'Additel ADT760',
  'Additel ADT761A',
  'Additel ADT762',
  'Additel ADT227',
  'Additel ADT209',
  'Additel ADT210',
  'Additel ADT220',
  'Additel ADT875',
  'Additel ADT949',
  'Additel ADT780',
  'WIKA CPH7000'
  , 'WIKA CPH6200',
  'WIKA CPH6400',
  'WIKA CPH7600',
  'WIKA CPG1500',
  'WIKA CPG500',
  'WIKA CPG2500',
  'Ashcroft ATE-2',
  'Ashcroft ATE-100',
  'GE UPS3',
  'GE UPS2E',
  'Honeywell STT850 Communicator Kit',
  'Rosemount 475 Field Communicator',
  'Rosemount AMS Trex',
  'Emerson Trex Device Communicator'
] as const;
const TEST_EQUIPMENT_OTHER = 'Other';
const STANDARD_SUSPEND_REASONS = [
  'Awaiting operations permit and access window for continuation.',
  'Process unavailable due to shutdown/startup constraints; resume on next window.',
  'Awaiting replacement parts or corrected installation prior to continuing checks.'
] as const;
const STANDARD_CANCEL_REASONS = [
  'Work scope cancelled by operations and reassigned to a future outage.',
  'Tag removed from service; turnover package closed per approved scope change.',
  'Job superseded by replacement instrument/loop and new work order issued.'
] as const;

export function JobRunner(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showSuspendForm, setShowSuspendForm] = useState<boolean>(false);
  const [showCancelForm, setShowCancelForm] = useState<boolean>(false);
  const [suspendReasonTemplate, setSuspendReasonTemplate] = useState<string>('');
  const [cancelReasonTemplate, setCancelReasonTemplate] = useState<string>('');
  const [preferredManufacturer, setPreferredManufacturer] = useState<string>('');
  const [inspectionSuggestions, setInspectionSuggestions] = useState<InspectionSuggestions>(DEFAULT_INSPECTION_SUGGESTIONS);
  const [brandingBadgeText, setBrandingBadgeText] = useState<string>('PDF branding: default template');
  const [suspendUntil, setSuspendUntil] = useState<string>('');
  const [suspendNotes, setSuspendNotes] = useState<string>('');
  const [cancelNotes, setCancelNotes] = useState<string>('');
  const [overallTechNotes, setOverallTechNotes] = useState<string>('');
  const [completionDisposition, setCompletionDisposition] = useState<string>('');
  const [exceptionCategory, setExceptionCategory] = useState<string>('');
  const [activeRole, setActiveRole] = useState<'tech' | 'lead' | 'admin'>('tech');
  const [isLockedByOther, setIsLockedByOther] = useState<boolean>(false);
  const [lockMessage, setLockMessage] = useState<string>('');
  const [showReopenForm, setShowReopenForm] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [reopenApprover, setReopenApprover] = useState<string>('');
  const [suspendBlockerOwner, setSuspendBlockerOwner] = useState<string>('');
  const [suspendBlockerDue, setSuspendBlockerDue] = useState<string>('');
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [celebrationEnabled, setCelebrationEnabled] = useState<boolean>(true);
  const [celebrationBurstKey, setCelebrationBurstKey] = useState<number>(0);
  const [celebrationExclamation, setCelebrationExclamation] = useState<string>('');
  const [configFieldDrafts, setConfigFieldDrafts] = useState<Record<string, string>>({});

  const jobId = Number(params.jobId ?? '0');

  const data = useLiveQuery(async () => {
    if (!Number.isFinite(jobId) || jobId <= 0) {
      return null;
    }
    return await getJobRunnerData(jobId);
  }, [jobId], null);

  const template = useLiveQuery(async () => {
    if (!data) {
      return null;
    }
    return await loadTemplate(data.job.jobType);
  }, [data?.job.jobType], null);

  const savedSignature = useLiveQuery(async () => {
    if (!data || typeof data.job.id !== 'number') {
      return null;
    }
    const rows = await db.signatures.where('jobId').equals(data.job.id).toArray();
    return rows[0] ?? null;
  }, [data?.job.id], null);

  const calibrationContext = data?.job.configValues?.calibrationContext ?? '';
  const calibrationDataMode = data?.job.configValues?.calibrationDataMode ?? '';
  const dpSquareRootLocation = data?.job.configValues?.dpSquareRootLocation ?? '';
  const calibrationTolerancePercentRaw = data?.job.configValues?.calibrationTolerancePercent ?? '';
  const calibrationTolerancePercent = parseTolerancePercent(calibrationTolerancePercentRaw) ?? DEFAULT_CALIBRATION_TOLERANCE_PERCENT;
  const calibrationToleranceMilliamp = (16 * calibrationTolerancePercent) / 100;
  const inferredTagPrefix = String(data?.tag.tagNumber ?? '').trim().match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? '';
  const normalizedTagType = (String(data?.tag.type ?? '').trim() || inferredTagPrefix).toUpperCase();
  const likelyDpFlowTag = ['FT', 'FQ', 'FE', 'DP', 'PDT'].some((key) => normalizedTagType.includes(key));
  const dpSquareRootMissing = data?.job.jobType === 'calibration' && likelyDpFlowTag && !dpSquareRootLocation;

  const calibrationReadiness = useMemo(() => {
    if (!data || data.job.jobType !== 'calibration') {
      return {
        failedPassFailCount: 0,
        outOfToleranceCount: 0,
        missingExpectedCount: 0,
        missingTolerance: false
      };
    }

    const failedPassFailCount = data.steps.filter((step) => step.inputType === 'passfail' && step.passFail === 'fail').length;
    const tolerance = calibrationToleranceMilliamp;
    const missingTolerance = false;
    const squareRootInTransmitter = dpSquareRootLocation === 'In Transmitter';

    let outOfToleranceCount = 0;
    let missingExpectedCount = 0;
    data.steps
      .filter((step): step is StepEntity & { id: number } => step.inputType === 'number' && typeof step.id === 'number')
      .forEach((step) => {
        const expected = calculateExpectedMilliamp(step.valueText, data.tag.lrv, data.tag.urv, data.tag.transferFunction, squareRootInTransmitter);
        if (typeof expected !== 'number') {
          missingExpectedCount += 1;
          return;
        }

        const asFoundOutOfTolerance = typeof step.valueNumber === 'number' && Math.abs(step.valueNumber - expected) > tolerance;
        const asLeftRaw = data.job.configValues?.[getAsLeftKey(step.id)] ?? '';
        const asLeftValue = parseNumericInput(asLeftRaw);
        const asLeftOutOfTolerance = calibrationDataMode === CALIBRATION_MODE_AS_FOUND_LEFT && typeof asLeftValue === 'number' && Math.abs(asLeftValue - expected) > tolerance;

        if (asFoundOutOfTolerance || asLeftOutOfTolerance) {
          outOfToleranceCount += 1;
        }
      });

    return {
      failedPassFailCount,
      outOfToleranceCount,
      missingExpectedCount,
      missingTolerance
    };
  }, [calibrationDataMode, calibrationToleranceMilliamp, data, dpSquareRootLocation]);

  const canComplete = useMemo(() => {
    if (!data) {
      return false;
    }
    const baseComplete = data.steps.every((step) => {
      if (data.job.jobType === 'calibration' && isLegacyCalibrationPhotoChecklistStep(step)) {
        return true;
      }
      return stepHasEntry(step);
    });

    if (data.job.jobType !== 'calibration') {
      return baseComplete;
    }

    const dispositionReady = countWords(completionDisposition) >= 5;

    const hasAsLeftGaps = calibrationDataMode === CALIBRATION_MODE_AS_FOUND_LEFT
      ? data.steps
          .filter((step): step is StepEntity & { id: number } => step.inputType === 'number' && typeof step.id === 'number')
          .some((step) => {
            const rawAsLeft = data.job.configValues?.[getAsLeftKey(step.id)] ?? '';
            return !Number.isFinite(Number(rawAsLeft));
          })
      : false;

    const hasCalibrationExceptions =
      calibrationReadiness.failedPassFailCount > 0 ||
      calibrationReadiness.outOfToleranceCount > 0 ||
      calibrationReadiness.missingExpectedCount > 0 ||
      calibrationReadiness.missingTolerance ||
      dpSquareRootMissing;

    const hasAnyCloseoutGap = !baseComplete || hasAsLeftGaps || hasCalibrationExceptions;
    if (hasAnyCloseoutGap) {
      return dispositionReady;
    }

    return true;
  }, [calibrationDataMode, calibrationReadiness, completionDisposition, data, dpSquareRootMissing]);

  useEffect(() => {
    const syncPreferences = (): void => {
      const prefs = loadSitePreferences();
      setPreferredManufacturer(prefs.preferredEquipmentManufacturer);
      setInspectionSuggestions(prefs.inspectionSuggestions);
      setActiveRole(prefs.activeUserRole);
      setCelebrationEnabled(prefs.celebrationModeEnabled);

      const companyName = String(prefs.pdfBranding?.companyName ?? '').trim();
      const hasLogo = String(prefs.pdfBranding?.logoDataUrl ?? '').trim().length > 0;
      const hasLetterhead = String(prefs.pdfBranding?.letterheadDataUrl ?? '').trim().length > 0;
      if (hasLetterhead) {
        setBrandingBadgeText(`PDF branding: letterhead${companyName ? ` (${companyName})` : ''}`);
        return;
      }
      if (hasLogo || companyName) {
        setBrandingBadgeText(`PDF branding: logo/header${companyName ? ` (${companyName})` : ''}`);
        return;
      }
      setBrandingBadgeText('PDF branding: default template');
    };

    const onStorage = (event: StorageEvent): void => {
      if (event.key === null || event.key === 'loopvault.sitePreferences.v1') {
        syncPreferences();
      }
    };

    syncPreferences();
    window.addEventListener(SITE_PREFERENCES_UPDATED_EVENT, syncPreferences as EventListener);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(SITE_PREFERENCES_UPDATED_EVENT, syncPreferences as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!celebrationBurstKey) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setCelebrationBurstKey(0);
      setCelebrationExclamation('');
    }, 1800);
    return () => window.clearTimeout(timeoutId);
  }, [celebrationBurstKey]);

  useEffect(() => {
    const nextNotes = data?.job.configValues?.overallTechNotes ?? '';
    setOverallTechNotes(nextNotes);
  }, [data?.job.configValues?.overallTechNotes]);

  useEffect(() => {
    const nextDisposition = data?.job.configValues?.completionDisposition ?? '';
    setCompletionDisposition(nextDisposition);
  }, [data?.job.configValues?.completionDisposition]);

  useEffect(() => {
    const nextCategory = data?.job.configValues?.exceptionCategory ?? '';
    setExceptionCategory(nextCategory);
  }, [data?.job.configValues?.exceptionCategory]);

  useEffect(() => {
    setConfigFieldDrafts({});
  }, [data?.job.id]);

  useEffect(() => {
    if (!data || data.job.status !== 'in-progress' || typeof data.job.id !== 'number') {
      setIsLockedByOther(false);
      setLockMessage('');
      return;
    }

    const currentDeviceId = getOrCreateDeviceId();
    const lockDeviceId = data.job.configValues?.lockDeviceId ?? '';
    const lockOwner = data.job.configValues?.lockOwner ?? '';
    if (lockDeviceId && lockDeviceId !== currentDeviceId) {
      setIsLockedByOther(true);
      setLockMessage(`Locked by ${lockOwner || 'another device'} (${lockDeviceId}).`);
      return;
    }

    setIsLockedByOther(false);
    setLockMessage('');
    if (!lockDeviceId) {
      void updateJobConfigValue(data.job.id, 'lockDeviceId', currentDeviceId);
      void updateJobConfigValue(data.job.id, 'lockOwner', data.job.techName || 'Unassigned');
      void updateJobConfigValue(data.job.id, 'lockRole', activeRole);
    }
  }, [activeRole, data]);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }
    const timeoutId = window.setTimeout(() => setStatusMessage(''), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  useEffect(() => {
    if (!data || !template) {
      return;
    }
    if (data.job.jobType !== 'calibration' || typeof data.job.id !== 'number') {
      return;
    }

    void withErrorGuard(async () => {
      const added = await ensureCalibrationInspectionSteps(data.job.id as number, data.steps, template.steps ?? []);
      if (added > 0) {
        setStatusMessage(`✓ Restored ${added} missing inspection checklist step${added === 1 ? '' : 's'}`);
      }
    }, 'Failed to restore inspection checklist steps.');
  }, [data, template]);

  const withErrorGuard = async (action: () => Promise<void>, fallbackMessage: string): Promise<void> => {
    try {
      await action();
      setError('');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : fallbackMessage);
    }
  };

  const assertCalibrationPreflightReady = (): boolean => {
    if (!data || data.job.jobType !== 'calibration') {
      return true;
    }
    const hasContext = calibrationContext.trim().length > 0;
    const hasSerial = String(data.job.configValues?.testEquipmentSerialNumber ?? '').trim().length > 0;
    if (!hasContext || !hasSerial) {
      setError('Set calibration context and equipment S/N before entering calibration data.');
      return false;
    }
    return true;
  };

  const onPassFailChange = async (stepId: number, value: 'pass' | 'fail' | 'na'): Promise<void> => {
    if (!assertCalibrationPreflightReady()) {
      return;
    }
    await withErrorGuard(async () => {
      await updateStep(stepId, { passFail: value });
    }, 'Failed to update pass/fail state.');
  };

  const onAddEvidence = async (stepId: number, file: File): Promise<void> => {
    if (!assertCalibrationPreflightReady()) {
      return;
    }
    await withErrorGuard(async () => {
      await addEvidence(stepId, file);
      setStatusMessage('✓ Photo evidence vaulted');
    }, 'Failed to add photo evidence.');
  };

  const onNumberChange = async (stepId: number, rawValue: string): Promise<void> => {
    if (!assertCalibrationPreflightReady()) {
      return;
    }
    await withErrorGuard(async () => {
      const parsed = parseNumericInput(rawValue);
      if (typeof parsed !== 'number') {
        await updateStep(stepId, { valueNumber: undefined });
        return;
      }
      if (parsed < 0) {
        throw new Error('Actual mA cannot be negative.');
      }
      await updateStep(stepId, { valueNumber: parsed });
    }, 'Failed to update numeric value.');
  };

  const onTextChange = async (stepId: number, value: string): Promise<void> => {
    await withErrorGuard(async () => {
      await updateStep(stepId, { valueText: value });
    }, 'Failed to update notes.');
  };

  const onAppliedInputChange = async (stepId: number, value: string): Promise<void> => {
    if (!assertCalibrationPreflightReady()) {
      return;
    }
    await withErrorGuard(async () => {
      await updateStep(stepId, { valueText: value });
    }, 'Failed to update applied input.');
  };

  const onTemplateConfigFieldChange = async (fieldId: string, value: string): Promise<void> => {
    if (!data) {
      return;
    }
    if (fieldId === 'testEquipment' || fieldId === 'testEquipmentCalDate') {
      const tagId = data.tag.id;
      if (typeof tagId !== 'number') {
        return;
      }
      await withErrorGuard(async () => {
        await updateTag(tagId, { [fieldId]: value });
        setStatusMessage('✓ Asset metadata vaulted');
      }, 'Failed to update asset metadata.');
      return;
    }

    const currentJobId = data.job.id;
    if (typeof currentJobId !== 'number') {
      return;
    }
    await withErrorGuard(async () => {
      await updateJobConfigValue(currentJobId, fieldId, value);
      if (fieldId === 'calibrationContext') {
        const currentMode = data.job.configValues?.calibrationDataMode ?? '';
        if (!currentMode) {
          await updateJobConfigValue(currentJobId, 'calibrationDataMode', defaultDataModeForContext(value));
        }
      }
      setStatusMessage('✓ Job config vaulted');
    }, 'Failed to update job config.');
  };

  const onTemplateConfigFieldDraftChange = (fieldId: string, value: string): void => {
    setConfigFieldDrafts((current) => ({ ...current, [fieldId]: value }));
  };

  const onTemplateConfigFieldBlur = (fieldId: string): void => {
    if (!data) {
      return;
    }
    const draftValue = configFieldDrafts[fieldId];
    if (typeof draftValue !== 'string') {
      return;
    }
    const persistedValue = fieldId === 'testEquipmentCalDate'
      ? data.tag.testEquipmentCalDate ?? ''
      : data.job.configValues?.[fieldId] ?? '';
    if (draftValue === persistedValue) {
      return;
    }
    void onTemplateConfigFieldChange(fieldId, draftValue);
  };

  const onTestEquipmentQuickSelect = async (value: string): Promise<void> => {
    if (!data || typeof data.tag.id !== 'number') {
      return;
    }

    if (value === TEST_EQUIPMENT_OTHER) {
      await withErrorGuard(async () => {
        await updateJobConfigValue(data.job.id as number, 'testEquipmentSelection', TEST_EQUIPMENT_OTHER);
        setStatusMessage('✓ Equipment selection updated');
      }, 'Failed to update equipment selection.');
      return;
    }

    await withErrorGuard(async () => {
      await updateTag(data.tag.id as number, { testEquipment: value });
      await updateJobConfigValue(data.job.id as number, 'testEquipmentSelection', value);
      setStatusMessage('✓ Equipment selection updated');
    }, 'Failed to update equipment selection.');
  };

  const onTestEquipmentCustomModelChange = async (value: string): Promise<void> => {
    if (!data || typeof data.tag.id !== 'number') {
      return;
    }

    await withErrorGuard(async () => {
      await updateTag(data.tag.id as number, { testEquipment: value });
      await updateJobConfigValue(data.job.id as number, 'testEquipmentSelection', TEST_EQUIPMENT_OTHER);
      await updateJobConfigValue(data.job.id as number, 'testEquipmentCustomModel', value);
      setStatusMessage('✓ Custom equipment model updated');
    }, 'Failed to update custom equipment model.');
  };

  const onTestEquipmentSerialChange = async (value: string): Promise<void> => {
    if (!data || typeof data.job.id !== 'number') {
      return;
    }

    await withErrorGuard(async () => {
      await updateJobConfigValue(data.job.id as number, 'testEquipmentSerialNumber', value);
      setStatusMessage('✓ Equipment S/N updated');
    }, 'Failed to update equipment serial number.');
  };

  const onAsLeftChange = async (stepId: number, rawValue: string): Promise<void> => {
    if (!assertCalibrationPreflightReady()) {
      return;
    }
    if (!data || typeof data.job.id !== 'number') {
      return;
    }
    await withErrorGuard(async () => {
      const parsed = parseNumericInput(rawValue);
      if (typeof parsed !== 'number') {
        await updateJobConfigValue(data.job.id as number, getAsLeftKey(stepId), '');
        return;
      }
      if (parsed < 0) {
        throw new Error('As-left mA cannot be negative.');
      }
      await updateJobConfigValue(data.job.id as number, getAsLeftKey(stepId), String(parsed));
    }, 'Failed to update as-left value.');
  };

  const onCalibrationTolerancePercentChange = async (value: string): Promise<void> => {
    if (!data || typeof data.job.id !== 'number') {
      return;
    }
    const parsed = parseTolerancePercent(value) ?? DEFAULT_CALIBRATION_TOLERANCE_PERCENT;
    await withErrorGuard(async () => {
      await updateJobConfigValue(data.job.id as number, 'calibrationTolerancePercent', String(parsed));
      setStatusMessage(`✓ Calibration tolerance set to ±${parsed}% of span`);
    }, 'Failed to update calibration tolerance.');
  };

  const onInspectionNotesChange = async (stepId: number, value: string): Promise<void> => {
    await withErrorGuard(async () => {
      await updateStep(stepId, { valueText: value });
    }, 'Failed to update inspection notes.');
  };

  const onOverallTechNotesBlur = async (): Promise<void> => {
    if (!data || typeof data.job.id !== 'number') {
      return;
    }
    await withErrorGuard(async () => {
      await updateJobConfigValue(data.job.id as number, 'overallTechNotes', overallTechNotes);
      setStatusMessage('✓ Overall tech notes saved');
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 'Failed to save overall tech notes.');
  };

  const onCompletionDispositionBlur = async (): Promise<void> => {
    if (!data || typeof data.job.id !== 'number') {
      return;
    }
    await withErrorGuard(async () => {
      await updateJobConfigValue(data.job.id as number, 'completionDisposition', completionDisposition);
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 'Failed to save exception disposition.');
  };

  const onCompleteJob = async (): Promise<void> => {
    if (!data) {
      setError('Job not found.');
      return;
    }
    if (isLockedByOther) {
      setError(lockMessage || 'This job is locked by another device.');
      return;
    }
    if (data.job.jobType === 'calibration' && (!calibrationContext.trim() || !equipmentSerialNumber.trim())) {
      setError('Calibration context and test equipment S/N are required before completion.');
      return;
    }
    const hasExceptionState =
      calibrationReadiness.failedPassFailCount > 0 ||
      calibrationReadiness.outOfToleranceCount > 0 ||
      calibrationReadiness.missingExpectedCount > 0 ||
      calibrationReadiness.missingTolerance ||
      dpSquareRootMissing;
    if (data.job.jobType === 'calibration' && hasExceptionState && !exceptionCategory.trim()) {
      setError('Exception category is required when unresolved calibration exceptions exist.');
      return;
    }
    if (!canComplete) {
      setError('Closeout requirements are not complete yet. Resolve remaining checklist items and required disposition text.');
      return;
    }
    await withErrorGuard(async () => {
      await updateJobConfigValue(data.job.id as number, 'completionDisposition', completionDisposition);
      await updateJobConfigValue(data.job.id as number, 'exceptionCategory', exceptionCategory);
      await completeJob(data.job.id as number);
      const baseStatus = countWords(completionDisposition) >= 5 ? '✓ Job marked as completed with exception disposition' : '✓ Job marked as completed';
      if (celebrationEnabled) {
        const exclamation = randomCelebrationExclamation();
        playCelebrationSound();
        setCelebrationExclamation(exclamation);
        setCelebrationBurstKey(Date.now());
        setStatusMessage(`${baseStatus} • ${exclamation}`);
      } else {
        setStatusMessage(baseStatus);
      }
    }, 'Failed to complete job.');
  };

  const onSuspendJob = async (): Promise<void> => {
    if (!data) {
      setError('Job not found.');
      return;
    }

    if (suspendUntil) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parsedSuspendDate = new Date(`${suspendUntil}T00:00:00`);
      if (Number.isNaN(parsedSuspendDate.getTime())) {
        setError('Postponement date is invalid.');
        return;
      }
      if (parsedSuspendDate < today) {
        setError('Postponement date cannot be in the past.');
        return;
      }
    }

    const noteWordCount = countWords(suspendNotes);
    if (noteWordCount < MIN_LIFECYCLE_NOTE_WORDS) {
      setError(`Suspension comment must be at least ${MIN_LIFECYCLE_NOTE_WORDS} words.`);
      return;
    }
    await withErrorGuard(async () => {
      await updateJobConfigValue(data.job.id as number, 'blockerOwner', suspendBlockerOwner);
      await updateJobConfigValue(data.job.id as number, 'blockerDue', suspendBlockerDue);
      await suspendJob(data.job.id as number, suspendUntil, suspendNotes);
      setStatusMessage(suspendUntil ? `✓ Job suspended until ${suspendUntil}` : '✓ Job suspended');
      setShowSuspendForm(false);
      setSuspendUntil('');
      setSuspendNotes('');
      setSuspendBlockerOwner('');
      setSuspendBlockerDue('');
    }, 'Failed to suspend job.');
  };

  const onCancelJob = async (): Promise<void> => {
    if (!data) {
      setError('Job not found.');
      return;
    }
    const noteWordCount = countWords(cancelNotes);
    if (noteWordCount < MIN_LIFECYCLE_NOTE_WORDS) {
      setError(`Cancellation comment must be at least ${MIN_LIFECYCLE_NOTE_WORDS} words.`);
      return;
    }
    await withErrorGuard(async () => {
      await cancelJob(data.job.id as number, cancelNotes);
      setStatusMessage('✓ Job cancelled');
      setShowCancelForm(false);
      setCancelNotes('');
    }, 'Failed to cancel job.');
  };

  const onResumeJob = async (): Promise<void> => {
    if (!data) {
      setError('Job not found.');
      return;
    }
    const wasCancelled = data.job.status === 'cancelled';
    await withErrorGuard(async () => {
      await resumeJob(data.job.id as number);
      await updateJobConfigValue(data.job.id as number, 'lockDeviceId', getOrCreateDeviceId());
      await updateJobConfigValue(data.job.id as number, 'lockOwner', data.job.techName || 'Unassigned');
      setStatusMessage(wasCancelled ? '✓ Job reopened' : '✓ Job resumed');
      setShowSuspendForm(false);
      setShowCancelForm(false);
    }, 'Failed to resume job.');
  };

  const onReopenCompletedJob = async (): Promise<void> => {
    if (!data || typeof data.job.id !== 'number') {
      setError('Job not found.');
      return;
    }
    if (activeRole !== 'lead' && activeRole !== 'admin') {
      setError('Only Lead or Admin can reopen completed jobs.');
      return;
    }
    await withErrorGuard(async () => {
      await reopenCompletedJob(data.job.id as number, {
        approverName: reopenApprover,
        approverRole: activeRole,
        reason: reopenReason
      });
      setShowReopenForm(false);
      setReopenApprover('');
      setReopenReason('');
      setStatusMessage('✓ Completed job reopened under approval policy');
    }, 'Failed to reopen completed job.');
  };

  const onSaveSignature = async (currentJobId: number, signedBy: string, file: Blob): Promise<void> => {
    await withErrorGuard(async () => {
      await saveSignature(currentJobId, signedBy, file);
      await updateJobTechName(currentJobId, signedBy);
      setStatusMessage('✓ Signature vaulted for job sign-off');
    }, 'Failed to save signature.');
  };

  const onGeneratePdf = async (): Promise<void> => {
    if (!data) {
      setError('Job data unavailable for PDF export.');
      return;
    }
    try {
      const signature = await getSignatureByJob(data.job.id as number);
      if (!signature) {
        setError('Please save a signature before generating the loop folder PDF.');
        return;
      }
      const evidence = await listEvidenceByJob(data.job.id as number);
      await generateLoopFolderPdf({
        job: data.job,
        tag: data.tag,
        steps: data.steps,
        evidence,
        signature
      });
      setStatusMessage('✓ Loop folder PDF generated');
      setError('');
    } catch (pdfError) {
      setError(pdfError instanceof Error ? `PDF export failed: ${pdfError.message}` : 'PDF export failed.');
    }
  };

  if (!data) {
    return <p className="rounded-lg border border-red-500 bg-red-950 p-3 text-sm">Job not found.</p>;
  }

  const canEditJob = data.job.status === 'in-progress' && !isLockedByOther;
  const calibrationPreflightReady = data.job.jobType !== 'calibration' || (calibrationContext.trim().length > 0 && String(data.job.configValues?.testEquipmentSerialNumber ?? '').trim().length > 0);
  const canEditWorkflow = canEditJob && calibrationPreflightReady;
  const isCompletedJob = data.job.status === 'completed';
  const isSuspendedJob = data.job.status === 'suspended';
  const isCancelledJob = data.job.status === 'cancelled';
  const suspendNotesWordCount = countWords(suspendNotes);
  const cancelNotesWordCount = countWords(cancelNotes);
  const suspendCommentValid = suspendNotesWordCount >= MIN_LIFECYCLE_NOTE_WORDS;
  const cancelCommentValid = cancelNotesWordCount >= MIN_LIFECYCLE_NOTE_WORDS;
  const calibrationInspectionSteps = data.job.jobType === 'calibration' ? data.steps.filter((step) => safeStartsWith(step.title, 'Inspection:')) : [];
  const calibrationOtherSteps =
    data.job.jobType === 'calibration'
      ? data.steps.filter((step) => step.inputType !== 'number' && !safeStartsWith(step.title, 'Inspection:') && !isLegacyCalibrationPhotoChecklistStep(step))
      : data.steps;
  const calibrationAsLeftEnabled = data.job.jobType === 'calibration' && calibrationDataMode === CALIBRATION_MODE_AS_FOUND_LEFT;
  const currentEquipmentModel = String(data.tag.testEquipment ?? '');
  const selectedEquipmentOption = TEST_EQUIPMENT_COMMON_OPTIONS.includes(currentEquipmentModel as (typeof TEST_EQUIPMENT_COMMON_OPTIONS)[number])
    ? currentEquipmentModel
    : currentEquipmentModel.trim().length > 0 || data.job.configValues?.testEquipmentSelection === TEST_EQUIPMENT_OTHER
      ? TEST_EQUIPMENT_OTHER
      : '';
  const prioritizedEquipmentOptions = getPrioritizedEquipmentOptions(preferredManufacturer);
  const equipmentSerialNumber = data.job.configValues?.testEquipmentSerialNumber ?? '';
  const stepCompletionReady = data.steps.every((step) => {
    if (data.job.jobType === 'calibration' && isLegacyCalibrationPhotoChecklistStep(step)) {
      return true;
    }
    return stepHasEntry(step);
  });
  const asLeftReady = calibrationAsLeftEnabled
    ? data.steps
        .filter((step): step is StepEntity & { id: number } => step.inputType === 'number' && typeof step.id === 'number')
        .every((step) => Number.isFinite(Number(data.job.configValues?.[getAsLeftKey(step.id)] ?? '')))
    : true;
  const exceptionFree =
    calibrationReadiness.failedPassFailCount === 0 &&
    calibrationReadiness.outOfToleranceCount === 0 &&
    calibrationReadiness.missingExpectedCount === 0 &&
    !calibrationReadiness.missingTolerance &&
    !dpSquareRootMissing;
  const hasSignature = Boolean(savedSignature);
  const dispositionReady = data.job.jobType !== 'calibration' || countWords(completionDisposition) >= 5;
  const calDueStatus = getCalDueStatus(data.tag.testEquipmentCalDate ?? '');
  const readinessItems = [
    { label: 'All required steps completed', pass: stepCompletionReady },
    { label: 'As-left entries complete (if enabled)', pass: asLeftReady },
    { label: 'No unresolved calibration exceptions', pass: data.job.jobType !== 'calibration' || exceptionFree },
    { label: 'Disposition note complete (when exceptions/gaps exist)', pass: dispositionReady },
    { label: 'Signature captured', pass: hasSignature }
  ];
  const firstBlockingItem = readinessItems.find((item) => !item.pass)?.label ?? '';
  const hasCalibrationExceptions =
    calibrationReadiness.failedPassFailCount > 0 ||
    calibrationReadiness.outOfToleranceCount > 0 ||
    calibrationReadiness.missingExpectedCount > 0 ||
    calibrationReadiness.missingTolerance ||
    dpSquareRootMissing;
  const showCalibrationDispositionPanel =
    hasCalibrationExceptions ||
    completionDisposition.trim().length > 0 ||
    exceptionCategory.trim().length > 0;
  const signatureInvalidatedAt = data.job.configValues?.signatureInvalidatedAt ?? '';
  const completionSnapshotHash = data.job.configValues?.completionSnapshotHash ?? '';

  return (
    <section className="lv-page">
      <p className="text-xs text-slate-300">Context: Tags / {data.tag.plant || '-'} / {data.tag.unit || '-'} / {data.tag.tagNumber} / Job #{data.job.id}</p>
      <button className="lv-btn-secondary" onClick={() => navigate(`/tags/${encodeURIComponent(data.tag.tagNumber)}`)} type="button">
        Back to Tag
      </button>
      <Link className="lv-btn-secondary" to="/help">
        Help & Docs
      </Link>

      <header className="lv-panel">
        <h2 className="text-xl font-bold text-safety">{data.tag.tagNumber}</h2>
        <p className="text-sm text-slate-200">Job Type: {data.job.jobType}</p>
        <div className="mt-1 flex items-center gap-2 text-sm text-slate-200">
          <span>Status:</span>
          <StatusChip
            label={
              data.job.status === 'completed'
                ? 'Complete'
                : data.job.status === 'suspended'
                  ? 'Suspended'
                  : data.job.status === 'cancelled'
                    ? 'Cancelled'
                    : 'In Progress'
            }
            tone={
              data.job.status === 'completed'
                ? 'success'
                : data.job.status === 'suspended'
                  ? 'warning'
                  : data.job.status === 'cancelled'
                    ? 'neutral'
                    : 'caution'
            }
          />
        </div>
        {data.job.status === 'suspended' && data.job.postponedUntil ? <p className="text-sm text-amber-300">Postponed Until: {data.job.postponedUntil}</p> : null}
        {data.job.lifecycleNotes ? <p className="text-xs text-slate-300">Notes: {data.job.lifecycleNotes}</p> : null}
        {isLockedByOther ? <p className="mt-1 rounded-lg border border-red-500 bg-red-950/40 p-2 text-xs text-red-200">Edit lock active: {lockMessage}</p> : null}
        {calDueStatus ? (
          <p className={`mt-1 text-xs font-semibold ${calDueStatus.tone === 'red' ? 'text-red-300' : calDueStatus.tone === 'amber' ? 'text-amber-300' : 'text-emerald-300'}`}>
            Equipment Cal Due: {calDueStatus.label}
          </p>
        ) : null}
      </header>

      {data.job.status === 'suspended' ? (
        <section className="lv-panel-quiet text-xs text-slate-200">
          <p className="font-semibold text-amber-200">Pending Blockers</p>
          <p className="mt-1">Owner: {data.job.configValues?.blockerOwner || '-'}</p>
          <p>Due: {data.job.configValues?.blockerDue || '-'}</p>
        </section>
      ) : null}

      <section className="lv-panel border-amber-500 bg-amber-950/25">
        <h3 className="text-base font-semibold text-amber-200">Next Best Action</h3>
        <p className="mt-1 text-sm text-amber-100">
          {canComplete ? 'Capture signature and complete job closeout when ready.' : `Resolve: ${firstBlockingItem || 'remaining closeout items'}.`}
        </p>
      </section>

      <section className="lv-panel">
        <h3 className="text-base font-semibold text-slate-100">Ready to Close Check</h3>
        <p className="mt-1 text-xs text-slate-300">Closeout quality gate before completion and turnover export.</p>
        <ul className="mt-3 space-y-2">
          {readinessItems.map((item) => (
            <li className="flex items-center justify-between rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm" key={item.label}>
              <span className="text-slate-200">{item.label}</span>
              <span className={`font-semibold ${item.pass ? 'text-emerald-300' : 'text-amber-300'}`}>{item.pass ? 'Ready' : 'Action Needed'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="lv-panel space-y-2">
        <h3 className="text-base font-semibold text-slate-100">Job Control</h3>

        {isSuspendedJob ? (
          <button className="lv-btn-primary" onClick={() => void onResumeJob()} type="button">
            Resume Job
          </button>
        ) : null}

        {isCancelledJob ? (
          <button className="lv-btn-secondary" onClick={() => void onResumeJob()} type="button">
            Reopen Cancelled Job
          </button>
        ) : null}

        {!isCompletedJob && !isCancelledJob && !isSuspendedJob ? (
          <div className="flex flex-wrap gap-2">
            <button className="lv-btn-secondary" onClick={() => setShowSuspendForm((prev) => !prev)} type="button">
              Suspend Job
            </button>
            <button className="lv-btn-danger" onClick={() => setShowCancelForm((prev) => !prev)} type="button">
              Cancel Job
            </button>
          </div>
        ) : null}

        {showSuspendForm ? (
          <div className="lv-panel-quiet space-y-2">
            <label className="block text-sm text-slate-300">
              Standard Reason
              <select
                className="lv-input mt-1 min-h-[40px] p-2"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setSuspendReasonTemplate(value);
                  if (value) {
                    setSuspendNotes(value);
                  }
                }}
                value={suspendReasonTemplate}
              >
                <option value="">Custom reason</option>
                {STANDARD_SUSPEND_REASONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-300">
              Optional Postponement Date
              <input className="lv-input mt-1 min-h-[40px] p-2" onChange={(event) => setSuspendUntil(event.currentTarget.value)} type="date" value={suspendUntil} />
            </label>
            <label className="block text-sm text-slate-300">
              Blocker Owner
              <input className="lv-input mt-1 min-h-[40px] p-2" onChange={(event) => setSuspendBlockerOwner(event.currentTarget.value)} placeholder="Ops / E&I Lead / Vendor" type="text" value={suspendBlockerOwner} />
            </label>
            <label className="block text-sm text-slate-300">
              Blocker Due Date
              <input className="lv-input mt-1 min-h-[40px] p-2" onChange={(event) => setSuspendBlockerDue(event.currentTarget.value)} type="date" value={suspendBlockerDue} />
            </label>
            <label className="block text-sm text-slate-300">
              Required Comment
              <textarea
                className="lv-input mt-1 min-h-[72px] p-2"
                onChange={(event) => setSuspendNotes(event.currentTarget.value)}
                placeholder="Reason for postpone, permit, access issue, and next action."
                value={suspendNotes}
              />
            </label>
            <p className={`text-xs ${suspendCommentValid ? 'text-emerald-300' : 'text-amber-300'}`}>
              Comment words: {suspendNotesWordCount}/{MIN_LIFECYCLE_NOTE_WORDS} minimum
            </p>
            <div className="flex gap-2">
              <button
                className={`min-h-[40px] rounded-lg px-3 py-2 text-sm font-bold ${suspendCommentValid ? 'bg-amber-400 text-black' : 'bg-slate-600 text-slate-300'}`}
                disabled={!suspendCommentValid}
                onClick={() => void onSuspendJob()}
                type="button"
              >
                Confirm Suspend
              </button>
              <button className="lv-btn-secondary min-h-[40px] px-3 py-2 text-sm" onClick={() => setShowSuspendForm(false)} type="button">
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {showCancelForm ? (
          <div className="lv-panel-quiet space-y-2">
            <label className="block text-sm text-slate-300">
              Standard Reason
              <select
                className="lv-input mt-1 min-h-[40px] p-2"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setCancelReasonTemplate(value);
                  if (value) {
                    setCancelNotes(value);
                  }
                }}
                value={cancelReasonTemplate}
              >
                <option value="">Custom reason</option>
                {STANDARD_CANCEL_REASONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-300">
              Required Comment
              <textarea
                className="lv-input mt-1 min-h-[72px] p-2"
                onChange={(event) => setCancelNotes(event.currentTarget.value)}
                placeholder="Why this job was cancelled and what follow-up is required."
                value={cancelNotes}
              />
            </label>
            <p className={`text-xs ${cancelCommentValid ? 'text-emerald-300' : 'text-amber-300'}`}>
              Comment words: {cancelNotesWordCount}/{MIN_LIFECYCLE_NOTE_WORDS} minimum
            </p>
            <div className="flex gap-2">
              <button
                className={`min-h-[40px] rounded-lg px-3 py-2 text-sm font-bold ${cancelCommentValid ? 'bg-red-500 text-black' : 'bg-slate-600 text-slate-300'}`}
                disabled={!cancelCommentValid}
                onClick={() => void onCancelJob()}
                type="button"
              >
                Confirm Cancel
              </button>
              <button className="lv-btn-secondary min-h-[40px] px-3 py-2 text-sm" onClick={() => setShowCancelForm(false)} type="button">
                Back
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="lv-panel">
        <h3 className="text-base font-semibold text-slate-100">Asset Metadata</h3>
        <div className="mt-3 grid gap-2 text-sm text-slate-200">
          <p>Description: {data.tag.description || '-'}</p>
          <p>Area: {data.tag.area || '-'}</p>
          <p>Unit: {data.tag.unit || '-'}</p>
          <p>Service: {data.tag.service || '-'}</p>
          {(template?.configFields ?? []).map((field) => (
            <label className="block" key={field.id}>
              <span className="text-sm text-slate-300">{field.label}</span>
              {field.id === 'testEquipment' ? (
                <div className="mt-2 space-y-2 rounded-lg border border-slate-600 bg-slate-900 p-3">
                  <select
                    className="lv-input"
                    disabled={!canEditJob}
                    onChange={(event) => void onTestEquipmentQuickSelect(event.currentTarget.value)}
                    value={selectedEquipmentOption}
                  >
                    <option value="">Select equipment</option>
                    {prioritizedEquipmentOptions.map((option, index) => (
                      <option key={`equipment-${index}-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value={TEST_EQUIPMENT_OTHER}>{TEST_EQUIPMENT_OTHER}</option>
                  </select>

                  {selectedEquipmentOption === TEST_EQUIPMENT_OTHER ? (
                    <input
                      className="lv-input"
                      disabled={!canEditJob}
                      onChange={(event) => void onTestEquipmentCustomModelChange(event.currentTarget.value)}
                      placeholder="Enter make/model"
                      type="text"
                      value={currentEquipmentModel}
                    />
                  ) : null}

                  <input
                    className="lv-input"
                    disabled={!canEditJob}
                    onChange={(event) => void onTestEquipmentSerialChange(event.currentTarget.value)}
                    placeholder="Equipment S/N"
                    type="text"
                    value={equipmentSerialNumber}
                  />
                </div>
              ) : field.type === 'select' ? (
                <select
                  className="lv-input mt-2"
                  disabled={!canEditJob}
                  onChange={(event) => void onTemplateConfigFieldChange(field.id, event.currentTarget.value)}
                  value={data.job.configValues?.[field.id] ?? ''}
                >
                  <option value="">Select option</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="lv-input mt-2"
                  disabled={!canEditJob}
                  onBlur={() => onTemplateConfigFieldBlur(field.id)}
                  onChange={(event) => onTemplateConfigFieldDraftChange(field.id, event.currentTarget.value)}
                  type={field.type === 'date' ? 'date' : 'text'}
                  value={
                    field.id === 'testEquipmentCalDate'
                      ? configFieldDrafts[field.id] ?? data.tag.testEquipmentCalDate ?? ''
                      : field.id === 'testEquipment'
                        ? data.tag.testEquipment ?? ''
                        : configFieldDrafts[field.id] ?? data.job.configValues?.[field.id] ?? ''
                  }
                />
              )}
            </label>
          ))}
        </div>
      </div>

      <section className="lv-panel">
        <h3 className="text-base font-semibold text-slate-100">Overall Tech Notes</h3>
        <textarea
          className="lv-input mt-2 min-h-[96px]"
          disabled={!canEditWorkflow}
          onBlur={() => void onOverallTechNotesBlur()}
          onChange={(event) => setOverallTechNotes(event.currentTarget.value)}
          placeholder="Add overall technician notes for this calibration job."
          value={overallTechNotes}
        />
        {lastSavedAt ? <p className="mt-2 text-xs text-slate-300">Saved locally at {lastSavedAt}</p> : null}
      </section>

      {data.job.jobType === 'calibration' ? (
        <section className="lv-panel text-sm">
          <h3 className="text-base font-semibold text-slate-100">Calibration Workflow</h3>
          <p className="mt-2 text-slate-300">Context: {calibrationContext || 'Select calibration context in Asset Metadata.'}</p>
          <p className="text-slate-300">Mode: {calibrationDataMode || defaultDataModeForContext(calibrationContext)}</p>
          <p className="text-slate-300">DP SQRT Extraction: {dpSquareRootLocation || 'Select location or Not Applicable.'}</p>
          <label className="mt-2 block text-xs text-slate-300">
            Reading Tolerance (±% of 16 mA span)
            <select
              className="lv-input mt-1 min-h-[40px] p-2"
              disabled={!canEditJob}
              onChange={(event) => void onCalibrationTolerancePercentChange(event.currentTarget.value)}
              value={String(calibrationTolerancePercent)}
            >
              {CALIBRATION_TOLERANCE_PERCENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  ±{option}%
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-slate-400">Out-of-tolerance threshold: ±{calibrationTolerancePercent.toFixed(2)}% span (±{calibrationToleranceMilliamp.toFixed(3)} mA).</p>
          {dpSquareRootMissing ? (
            <p className="mt-2 rounded-lg border border-amber-500 bg-amber-950/40 p-2 text-xs text-amber-200">
              Flow/DP tag detected ({normalizedTagType}). Select DP square-root extraction location before completing calibration.
            </p>
          ) : null}
          {calibrationReadiness.missingTolerance ? <p className="mt-2 rounded-lg border border-amber-500 bg-amber-950/40 p-2 text-xs text-amber-200">Calibration tolerance is missing/invalid. Set tag Max Error (e.g., 0.1% or 0.016 mA) before completion.</p> : null}
          {calibrationReadiness.missingExpectedCount > 0 ? <p className="mt-2 rounded-lg border border-amber-500 bg-amber-950/40 p-2 text-xs text-amber-200">One or more calibration points are missing a valid expected value. Verify applied input and LRV/URV.</p> : null}
          {showCalibrationDispositionPanel ? (
            <div className="mt-2 rounded-lg border border-amber-500 bg-amber-950/40 p-2">
              <p className="text-xs text-amber-200">
                Exceptions present: {calibrationReadiness.failedPassFailCount} failed checklist item(s), {calibrationReadiness.outOfToleranceCount} out-of-tolerance point(s).
              </p>
              <label className="mt-2 block text-xs text-amber-100">
                Exception Category (required)
                <select className="lv-input mt-1 min-h-[40px] p-2" disabled={!canEditWorkflow} onChange={(event) => setExceptionCategory(event.currentTarget.value)} value={exceptionCategory}>
                  <option value="">Select category</option>
                  <option value="safety-critical">Safety-Critical</option>
                  <option value="quality-critical">Quality-Critical</option>
                  <option value="administrative">Administrative</option>
                </select>
              </label>
              <label className="mt-2 block text-xs text-amber-100">
                Exception Disposition (required to complete)
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white"
                  disabled={!canEditWorkflow}
                  onBlur={() => void onCompletionDispositionBlur()}
                  onChange={(event) => setCompletionDisposition(event.currentTarget.value)}
                  placeholder="Document root cause, compensating actions, approvals, and follow-up plan."
                  value={completionDisposition}
                />
              </label>
              <p className="mt-1 text-xs text-amber-100">Disposition words: {countWords(completionDisposition)}/5 minimum</p>
            </div>
          ) : null}
          <p className="mt-1 text-xs text-slate-400">Use Single Pass for new install / out-of-box checks, and As Found + As Left for maintenance/T-A recalibration.</p>
        </section>
      ) : null}

      {statusMessage ? <p aria-live="polite" className="rounded-lg border border-emerald-400 bg-emerald-950 p-3 text-sm font-semibold text-emerald-100">{statusMessage}</p> : null}
      {celebrationEnabled && celebrationBurstKey ? <CelebrationConfetti burstKey={celebrationBurstKey} label={celebrationExclamation} /> : null}
      {error ? <p aria-live="assertive" className="rounded-lg border border-red-500 bg-red-950 p-3 text-sm">{error}</p> : null}

      <div className="space-y-3">
        {data.job.jobType === 'calibration' ? (
          <CalibrationGrid
            asLeftEnabled={calibrationAsLeftEnabled}
            asLeftValues={data.job.configValues ?? {}}
            canEdit={canEditWorkflow}
            dpSquareRootLocation={dpSquareRootLocation}
            engUnit={data.tag.engUnit}
            lrv={data.tag.lrv}
            toleranceMilliamp={calibrationToleranceMilliamp}
            steps={data.steps.filter((step) => step.inputType === 'number')}
            transferFunction={data.tag.transferFunction}
            urv={data.tag.urv}
            onActualChange={onNumberChange}
            onAsLeftChange={onAsLeftChange}
            onAppliedInputChange={onAppliedInputChange}
            onCaptureEvidence={onAddEvidence}
          />
        ) : null}

        {data.job.jobType === 'calibration' && calibrationInspectionSteps.length > 0 ? <h3 className="text-base font-semibold text-slate-100">Inspection Checklist</h3> : null}
        {(data.job.jobType === 'calibration' ? calibrationInspectionSteps : []).map((step, index) => (
          <article className="lv-panel" key={getStepRenderKey(step, index, 'inspection')}>
            <h3 className="text-lg font-semibold">{step.title || 'Inspection Item'}</h3>
            {step.inputType === 'passfail' ? <p className="mt-1 text-xs text-slate-400">Guidance available</p> : null}
            {step.inputType === 'passfail' ? <SuggestedChecksDropdown items={getInspectionSuggestions(step.title || '', inspectionSuggestions)} otherItems={inspectionSuggestions.other} /> : null}
            {step.inputType === 'passfail' ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  className={`min-h-[44px] rounded-lg px-4 py-3 text-lg font-bold ${step.passFail === 'pass' ? 'border-2 border-emerald-200 bg-emerald-500 text-black' : 'border-2 border-slate-500 bg-slate-100 text-slate-900'}`}
                  disabled={!canEditWorkflow}
                  onClick={() => void onPassFailChange(step.id as number, 'pass')}
                  type="button"
                >
                  ✓ Pass
                </button>
                <button
                  className={`min-h-[44px] rounded-lg px-4 py-3 text-lg font-bold ${step.passFail === 'fail' ? 'border-2 border-red-200 bg-red-500 text-black' : 'border-2 border-slate-500 bg-slate-100 text-slate-900'}`}
                  disabled={!canEditWorkflow}
                  onClick={() => void onPassFailChange(step.id as number, 'fail')}
                  type="button"
                >
                  ✗ Fail
                </button>
                <button
                  className={`min-h-[44px] rounded-lg px-4 py-3 text-lg font-bold ${step.passFail === 'na' ? 'border-2 border-slate-200 bg-slate-500 text-white' : 'border-2 border-slate-500 bg-slate-100 text-slate-900'}`}
                  disabled={!canEditWorkflow}
                  onClick={() => void onPassFailChange(step.id as number, 'na')}
                  type="button"
                >
                  N/A
                </button>
              </div>
            ) : null}
            {step.inputType === 'passfail' && typeof step.id === 'number' ? (
              <label className="mt-3 block">
                <span className="text-sm text-slate-300">Inspection Notes</span>
                <textarea
                  className="lv-input mt-2 min-h-[72px]"
                  disabled={!canEditWorkflow}
                  onChange={(event) => void onInspectionNotesChange(step.id as number, event.currentTarget.value)}
                  placeholder="Add inspection findings, observations, or exceptions."
                  value={step.valueText ?? ''}
                />
              </label>
            ) : null}
            {typeof step.id === 'number' ? <PhotoCapture disabled={!canEditWorkflow} stepId={step.id} onCapture={onAddEvidence} /> : null}
          </article>
        ))}

        {calibrationOtherSteps.map((step, index) => (
          <article className="lv-panel" key={getStepRenderKey(step, index, 'general')}>
            <h3 className="text-lg font-semibold">{step.title || 'Checklist Item'}</h3>
            {step.inputType === 'passfail' ? <p className="mt-1 text-xs text-slate-400">Guidance available</p> : null}
            {step.inputType === 'passfail' ? <SuggestedChecksDropdown items={getInspectionSuggestions(step.title || '', inspectionSuggestions)} otherItems={inspectionSuggestions.other} /> : null}
            {step.inputType === 'passfail' ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  className={`min-h-[44px] rounded-lg px-4 py-3 text-lg font-bold ${step.passFail === 'pass' ? 'border-2 border-emerald-200 bg-emerald-500 text-black' : 'border-2 border-slate-500 bg-slate-100 text-slate-900'}`}
                  disabled={!canEditWorkflow}
                  onClick={() => void onPassFailChange(step.id as number, 'pass')}
                  type="button"
                >
                  ✓ Pass
                </button>
                <button
                  className={`min-h-[44px] rounded-lg px-4 py-3 text-lg font-bold ${step.passFail === 'fail' ? 'border-2 border-red-200 bg-red-500 text-black' : 'border-2 border-slate-500 bg-slate-100 text-slate-900'}`}
                  disabled={!canEditWorkflow}
                  onClick={() => void onPassFailChange(step.id as number, 'fail')}
                  type="button"
                >
                  ✗ Fail
                </button>
                <button
                  className={`min-h-[44px] rounded-lg px-4 py-3 text-lg font-bold ${step.passFail === 'na' ? 'border-2 border-slate-200 bg-slate-500 text-white' : 'border-2 border-slate-500 bg-slate-100 text-slate-900'}`}
                  disabled={!canEditWorkflow}
                  onClick={() => void onPassFailChange(step.id as number, 'na')}
                  type="button"
                >
                  N/A
                </button>
              </div>
            ) : null}

            {step.inputType === 'number' ? (
              <label className="mt-3 block">
                <span className="text-sm text-slate-300">Measurement ({step.unit ?? 'value'})</span>
                <input
                  className="lv-input mt-2 text-lg"
                  disabled={!canEditWorkflow}
                  inputMode="decimal"
                  min={0}
                  onChange={(event) => void onNumberChange(step.id as number, event.currentTarget.value)}
                  type="number"
                  value={typeof step.valueNumber === 'number' ? String(step.valueNumber) : ''}
                />
              </label>
            ) : null}

            {step.inputType === 'text' ? (
              <label className="mt-3 block">
                <span className="text-sm text-slate-300">Notes</span>
                <textarea
                  className="lv-input mt-2 min-h-[44px]"
                  disabled={!canEditWorkflow}
                  onChange={(event) => void onTextChange(step.id as number, event.currentTarget.value)}
                  value={step.valueText}
                />
              </label>
            ) : null}

            {typeof step.id === 'number' ? <PhotoCapture disabled={!canEditWorkflow} stepId={step.id} onCapture={onAddEvidence} /> : null}
          </article>
        ))}
      </div>

      <button
        className={`lv-btn-primary min-h-16 w-full text-lg ${canComplete ? '' : 'bg-slate-600 text-slate-300'}`}
        disabled={!canEditWorkflow || !canComplete}
        onClick={() => void onCompleteJob()}
        type="button"
      >
        Complete Job
      </button>
      {!calibrationPreflightReady && canEditJob ? <p className="text-sm text-amber-300">Calibration preflight required: set Context and equipment S/N before data entry.</p> : null}
      {!canComplete && canEditJob ? <p className="text-sm text-amber-300">Fill every required step and As-Left values (if enabled) before completing the job.</p> : null}
      {dpSquareRootMissing && canEditJob ? <p className="text-sm text-amber-300">Select DP SQRT extraction location in Asset Metadata for this flow/DP calibration.</p> : null}
      {!canEditJob ? <p className="text-sm text-amber-300">Job is not in progress. Resume to continue editing.</p> : null}

      {canEditWorkflow || data.job.status === 'completed' ? <SignaturePad initialTechName={data.job.techName} jobId={data.job.id as number} onSave={onSaveSignature} /> : null}
      {signatureInvalidatedAt ? <p className="rounded-lg border border-red-500 bg-red-950/40 p-2 text-xs text-red-200">Signature trust warning: records changed after signature at {signatureInvalidatedAt}. Re-sign before turnover.</p> : null}

      {data.job.status === 'completed' ? (
        <>
          <p className="rounded-lg border border-slate-600 bg-slate-800 p-2 text-xs text-slate-200">{brandingBadgeText}</p>
          {completionSnapshotHash ? <p className="rounded-lg border border-slate-600 bg-slate-800 p-2 text-xs text-slate-200">Completion Snapshot Hash: {completionSnapshotHash}</p> : null}
          <p className="rounded-lg border border-slate-600 bg-slate-800 p-2 text-xs text-slate-200">Completion UTC: {data.job.configValues?.completionUtc || '-'} • Local: {data.job.configValues?.completionLocal || '-'}</p>
          <button className="min-h-16 w-full rounded-xl bg-safety px-4 py-4 text-lg font-bold text-black" onClick={() => void onGeneratePdf()} type="button">
            Generate Loop Folder
          </button>
          {activeRole === 'lead' || activeRole === 'admin' ? (
            <section className="lv-panel-quiet space-y-2">
              <button className="lv-btn-secondary" onClick={() => setShowReopenForm((current) => !current)} type="button">
                Reopen Completed Job
              </button>
              {showReopenForm ? (
                <div className="space-y-2">
                  <input className="lv-input" onChange={(event) => setReopenApprover(event.currentTarget.value)} placeholder="Approver name" type="text" value={reopenApprover} />
                  <textarea className="lv-input min-h-[72px]" onChange={(event) => setReopenReason(event.currentTarget.value)} placeholder="Reason for reopen (minimum 5 words)." value={reopenReason} />
                  <button className="lv-btn-danger" onClick={() => void onReopenCompletedJob()} type="button">
                    Confirm Reopen
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function CelebrationConfetti(props: { burstKey: number; label: string }): JSX.Element {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        id: `${props.burstKey}-${index}`,
        left: `${Math.round(Math.random() * 96)}%`,
        delay: `${(Math.random() * 0.5).toFixed(2)}s`,
        duration: `${(0.9 + Math.random() * 1.3).toFixed(2)}s`,
        rotate: `${Math.round(-140 + Math.random() * 280)}deg`,
        color: ['#FCE300', '#22c55e', '#f472b6', '#60a5fa', '#fb923c'][index % 5]
      })),
    [props.burstKey]
  );

  return (
    <div className="pointer-events-none relative overflow-hidden rounded-xl border border-safety/40 bg-slate-900/50 p-2" role="status">
      <p className="mb-1 text-center text-xs font-semibold text-safety">{props.label || 'Nice work!'}</p>
      <div className="relative h-20">
        {pieces.map((piece) => (
          <span
            className="lv-confetti-piece"
            key={piece.id}
            style={{
              left: piece.left,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              transform: `rotate(${piece.rotate})`,
              backgroundColor: piece.color
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface CalibrationGridRow {
  stepId: number;
  appliedInput: string;
}

function CalibrationGrid(props: {
  asLeftEnabled: boolean;
  asLeftValues: Record<string, string>;
  canEdit: boolean;
  dpSquareRootLocation: string;
  steps: StepEntity[];
  lrv: string;
  urv: string;
  toleranceMilliamp: number;
  engUnit: string;
  transferFunction: string;
  onAppliedInputChange: (stepId: number, value: string) => Promise<void>;
  onActualChange: (stepId: number, value: string) => Promise<void>;
  onAsLeftChange: (stepId: number, value: string) => Promise<void>;
  onCaptureEvidence: (stepId: number, file: File) => Promise<void>;
}): JSX.Element | null {
  const {
    asLeftEnabled,
    asLeftValues,
    canEdit,
    dpSquareRootLocation,
    steps,
    lrv,
    urv,
    toleranceMilliamp,
    engUnit,
    transferFunction,
    onAppliedInputChange,
    onActualChange,
    onAsLeftChange,
    onCaptureEvidence
  } = props;

  const numericSteps = useMemo(() => steps.filter((step): step is StepEntity & { id: number } => typeof step.id === 'number'), [steps]);

  const [rows, setRows] = useState<CalibrationGridRow[]>(
    numericSteps.map((step) => ({
      stepId: step.id,
      appliedInput: typeof step.valueText === 'string' ? step.valueText : ''
    }))
  );

  useEffect(() => {
    setRows((currentRows) => {
      const byId = new Map(currentRows.map((row) => [row.stepId, row.appliedInput]));
      return numericSteps.map((step) => ({
        stepId: step.id,
        appliedInput: byId.get(step.id) ?? (typeof step.valueText === 'string' ? step.valueText : '')
      }));
    });
  }, [numericSteps]);

  useEffect(() => {
    const autoPoints = calculateFivePointInputs(lrv, urv, 2);
    if (!autoPoints || numericSteps.length === 0) {
      return;
    }

    setRows((currentRows) =>
      currentRows.map((row, index) => {
        if (row.appliedInput.trim().length > 0) {
          return row;
        }
        return {
          ...row,
          appliedInput: String(autoPoints[index] ?? row.appliedInput)
        };
      })
    );
  }, [lrv, urv, numericSteps.length]);

  useEffect(() => {
    const autoPoints = calculateFivePointInputs(lrv, urv, 2);
    if (!autoPoints || numericSteps.length === 0) {
      return;
    }

    numericSteps.forEach((step, index) => {
      if (step.valueText.trim().length > 0) {
        return;
      }
      const autoPoint = autoPoints[index];
      if (!Number.isFinite(autoPoint)) {
        return;
      }
      void onAppliedInputChange(step.id, String(autoPoint));
    });
  }, [numericSteps, lrv, onAppliedInputChange, urv]);

  if (numericSteps.length === 0) {
    return null;
  }

  const engUnitLabel = engUnit || '-';
  const hasValidRange = calculateFivePointInputs(lrv, urv, 2) !== null;
  const transferFunctionUsesSquareRoot = transferFunction.toLowerCase().includes('square');
  const squareRootInTransmitter = dpSquareRootLocation === 'In Transmitter';
  const expectedModeLabel = squareRootInTransmitter
    ? 'Expected mA mode: Square-root (In Transmitter)'
    : transferFunctionUsesSquareRoot
      ? 'Expected mA mode: Square-root (Transfer Function)'
      : 'Expected mA mode: Linear';
  const expectedModeClassName = squareRootInTransmitter || transferFunctionUsesSquareRoot
    ? 'mt-1 inline-block rounded-md border border-amber-500 bg-amber-950/40 px-2 py-1 text-xs font-semibold text-amber-200'
    : 'mt-1 inline-block rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-300';

  const onAppliedInputEdit = (stepId: number, value: string): void => {
    setRows((currentRows) => currentRows.map((row) => (row.stepId === stepId ? { ...row, appliedInput: value } : row)));
    void onAppliedInputChange(stepId, value);
  };

  return (
    <article className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <h3 className="text-lg font-semibold">Calibration Grid</h3>
      <p className={expectedModeClassName}>{expectedModeLabel}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-600 text-slate-300">
              <th className="p-2">Point</th>
              <th className="p-2">Applied Input ({engUnitLabel})</th>
              <th className="p-2">Expected (mA)</th>
              <th className="p-2">As-Found (mA)</th>
              {asLeftEnabled ? <th className="p-2">As-Left (mA)</th> : null}
              {asLeftEnabled ? <th className="p-2">% Dev (AF→AL)</th> : null}
              <th className="p-2">Photo</th>
            </tr>
          </thead>
          <tbody>
            {numericSteps.map((step, index) => {
              const row = rows.find((entry) => entry.stepId === step.id);
              const appliedInputText = row?.appliedInput ?? '';
              const expectedValue = calculateExpectedMilliamp(
                appliedInputText,
                lrv,
                urv,
                transferFunction,
                dpSquareRootLocation === 'In Transmitter'
              );
              const asFoundValue = typeof step.valueNumber === 'number' ? step.valueNumber : undefined;
              const asLeftValue = parseNumericInput(asLeftValues[getAsLeftKey(step.id)] ?? '');
              const percentDeviation =
                typeof asFoundValue === 'number' && typeof asLeftValue === 'number'
                  ? calculateAsFoundToAsLeftSpanPercentDeviation(asFoundValue, asLeftValue)
                  : undefined;
              const asFoundOutOfTolerance =
                typeof asFoundValue === 'number' &&
                typeof expectedValue === 'number' &&
                Math.abs(asFoundValue - expectedValue) > toleranceMilliamp;
              const asLeftOutOfTolerance =
                asLeftEnabled &&
                typeof asLeftValue === 'number' &&
                typeof expectedValue === 'number' &&
                Math.abs(asLeftValue - expectedValue) > toleranceMilliamp;
              const isOutOfTolerance = asFoundOutOfTolerance || asLeftOutOfTolerance;

              return (
                <tr className={`border-b ${isOutOfTolerance ? 'border-red-600 bg-red-950/20' : 'border-slate-700'}`} key={step.id}>
                  <td className="p-2 text-slate-200">{step.title || `Point ${index + 1}`}</td>
                  <td className="p-2">
                    <input
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-base"
                      disabled={!canEdit}
                      inputMode="decimal"
                      onChange={(event) => onAppliedInputEdit(step.id, event.currentTarget.value)}
                      type="number"
                      value={appliedInputText}
                    />
                  </td>
                  <td className="p-2 text-slate-100">{typeof expectedValue === 'number' ? expectedValue.toFixed(3) : ''}</td>
                  <td className="p-2">
                    <input
                      className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-base"
                      disabled={!canEdit}
                      inputMode="decimal"
                      min={0}
                      onChange={(event) => void onActualChange(step.id, event.currentTarget.value)}
                      type="number"
                      value={typeof step.valueNumber === 'number' ? String(step.valueNumber) : ''}
                    />
                  </td>
                  {asLeftEnabled ? (
                    <td className="p-2">
                      <input
                        className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-base"
                        disabled={!canEdit}
                        inputMode="decimal"
                        min={0}
                        onChange={(event) => void onAsLeftChange(step.id, event.currentTarget.value)}
                        type="number"
                        value={asLeftValues[getAsLeftKey(step.id)] ?? ''}
                      />
                    </td>
                  ) : null}
                  {asLeftEnabled ? <td className="p-2 text-slate-100">{typeof percentDeviation === 'number' ? `${percentDeviation.toFixed(2)}%` : ''}</td> : null}
                  <td className="p-2">
                    <div className="mt-2">
                      <PhotoCapture disabled={!canEdit} stepId={step.id} onCapture={onCaptureEvidence} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!hasValidRange ? (
        <p className="mt-3 rounded-lg border border-amber-500 bg-amber-950 p-3 text-sm text-amber-200">
          Enter valid LRV and URV metadata to auto-populate the 5-point applied inputs.
        </p>
      ) : null}
    </article>
  );
}

function stepHasEntry(step: StepEntity): boolean {
  if (step.inputType === 'passfail') {
    return step.passFail === 'pass' || step.passFail === 'fail' || step.passFail === 'na';
  }
  if (step.inputType === 'number') {
    return typeof step.valueNumber === 'number' && Number.isFinite(step.valueNumber);
  }
  return typeof step.valueText === 'string' && step.valueText.trim().length > 0;
}

function calculateAsFoundToAsLeftSpanPercentDeviation(asFound: number, asLeft: number): number | undefined {
  if (!Number.isFinite(asFound) || !Number.isFinite(asLeft)) {
    return undefined;
  }
  const milliampSpan = 16;
  return Math.abs(((asLeft - asFound) / milliampSpan) * 100);
}

function isLegacyCalibrationPhotoChecklistStep(step: StepEntity): boolean {
  return safeStartsWith(step.title, 'Photo Evidence:') || safeStartsWith(step.templateStepId, 'CAL-PHOTO-');
}

function safeStartsWith(value: unknown, prefix: string): boolean {
  return typeof value === 'string' && value.startsWith(prefix);
}

function getStepRenderKey(step: StepEntity, index: number, scope: string): string {
  if (typeof step.id === 'number') {
    return `${scope}-step-id-${step.id}`;
  }
  if (typeof step.templateStepId === 'string' && step.templateStepId.trim().length > 0) {
    return `${scope}-step-template-${step.templateStepId}-${index}`;
  }
  return `${scope}-step-fallback-${index}`;
}

function countWords(input: string): number {
  const words = input
    .trim()
    .split(/\s+/)
    .filter((segment) => segment.length > 0);
  return words.length;
}

function getAsLeftKey(stepId: number): string {
  return `asLeft_${stepId}`;
}

function defaultDataModeForContext(context: string): string {
  if (context.includes('Maintenance') || context.includes('T-A')) {
    return CALIBRATION_MODE_AS_FOUND_LEFT;
  }
  if (context.includes('Commissioning')) {
    return CALIBRATION_MODE_SINGLE_PASS;
  }
  if (context.includes('New Construction') || context.includes('Out Of Box') || context.includes('Bench')) {
    return CALIBRATION_MODE_SINGLE_PASS;
  }
  return CALIBRATION_MODE_AS_FOUND_LEFT;
}

function parseTolerancePercent(rawTolerance: string): number | undefined {
  const normalized = String(rawTolerance ?? '').trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const parsedNumber = Number(normalized.replace(/[^0-9.+-]/g, ''));
  if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
    return undefined;
  }

  return parsedNumber;
}

function getInspectionSuggestions(stepTitle: string, policy: InspectionSuggestions): string[] {
  const title = stepTitle.toLowerCase();

  if (title.includes('nameplate') || title.includes('tag')) {
    return policy.nameplateTag;
  }

  if (title.includes('installation') || title.includes('impulse') || title.includes('process')) {
    return policy.installationConnections;
  }

  if (title.includes('wiring') || title.includes('termination') || title.includes('shield')) {
    return policy.wiringShielding;
  }

  return policy.fallback;
}

function PhotoCapture(props: { stepId: number; disabled?: boolean; onCapture: (stepId: number, file: File) => Promise<void> }): JSX.Element {
  return (
    <label className={`mt-3 inline-flex min-h-[44px] items-center rounded-lg border px-3 py-2 text-sm font-semibold ${props.disabled ? 'cursor-not-allowed border-slate-600 bg-slate-700 text-slate-300' : 'cursor-pointer border-slate-400 bg-slate-100 text-slate-900'}`}>
      📷 Add Photo
      <input
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={props.disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (!file) {
            return;
          }
          void props.onCapture(props.stepId, file);
          event.currentTarget.value = '';
        }}
        type="file"
      />
    </label>
  );
}

function SuggestedChecksDropdown(props: { items: string[]; otherItems: string[] }): JSX.Element {
  return (
    <details className="mt-2 rounded-lg border border-slate-600 bg-slate-900 p-2">
      <summary className="cursor-pointer text-xs font-semibold text-slate-100">Suggested checks for pass/fail</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300">
        {props.items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
      {props.otherItems.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-200">Other (site-specific)</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-300">
            {props.otherItems.map((item, index) => (
              <li key={`other-${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </details>
  );
}

function getPrioritizedEquipmentOptions(preferredManufacturer: string): string[] {
  const source = [...TEST_EQUIPMENT_COMMON_OPTIONS];
  if (!preferredManufacturer) {
    return source;
  }

  const normalizedPreferred = preferredManufacturer.toLowerCase();
  const preferred = source.filter((option) => option.toLowerCase().startsWith(normalizedPreferred));
  const remaining = source.filter((option) => !option.toLowerCase().startsWith(normalizedPreferred));
  return [...preferred, ...remaining];
}

function getCalDueStatus(rawDate: string): { label: string; tone: 'red' | 'amber' | 'emerald' } | null {
  const value = String(rawDate ?? '').trim();
  if (!value) {
    return null;
  }
  const due = new Date(value);
  if (!Number.isFinite(due.getTime())) {
    return { label: `Invalid date (${value})`, tone: 'amber' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueStart = new Date(due);
  dueStart.setHours(0, 0, 0, 0);
  const deltaDays = Math.round((dueStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (deltaDays < 0) {
    return { label: `${value} (${Math.abs(deltaDays)} day(s) overdue)`, tone: 'red' };
  }
  if (deltaDays <= 30) {
    return { label: `${value} (due in ${deltaDays} day(s))`, tone: 'amber' };
  }
  return { label: `${value} (in calibration window)`, tone: 'emerald' };
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
