import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EvidenceEntity, JobEntity, SignatureEntity, StepEntity, TagEntity } from '../db';
import { loadSitePreferences } from '../config/sitePreferences';
import { calculateExpectedMilliamp, parseNumericInput } from './calibrationMath';

interface GeneratePdfInput {
  job: JobEntity;
  tag: TagEntity;
  steps: StepEntity[];
  evidence: Array<{ step: StepEntity; records: EvidenceEntity[] }>;
  signature: SignatureEntity | null;
}

export async function generateLoopFolderPdf(input: GeneratePdfInput): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const createdAt = new Date().toISOString();
  const createdAtLocal = new Date(createdAt).toLocaleString();
  const prefs = loadSitePreferences();
  const companyName = prefs.pdfBranding.companyName || 'Company';
  const headerBottomY = await renderBrandingHeader(doc, prefs.pdfBranding.companyName, prefs.pdfBranding.logoDataUrl, prefs.pdfBranding.letterheadDataUrl);

  doc.setFontSize(11);
  doc.text(`Company: ${companyName}`, 40, headerBottomY + 16);
  doc.text(`Tag: ${input.tag.tagNumber}`, 40, headerBottomY + 33);
  doc.text(`Date (UTC): ${createdAt}`, 40, headerBottomY + 50);
  doc.text(`Date (Local): ${createdAtLocal}`, 40, headerBottomY + 67);
  doc.text(`Tech Name: ${input.job.techName}`, 40, headerBottomY + 84);
  const equipmentSerial = input.job.configValues?.testEquipmentSerialNumber ?? '-';
  doc.text(`Test Equipment: ${input.tag.testEquipment || '-'} | S/N: ${equipmentSerial} | Cal Due: ${input.tag.testEquipmentCalDate || '-'}`, 40, headerBottomY + 101);

  doc.text(`Job Type: ${input.job.jobType}`, 320, headerBottomY + 33);
  doc.text(`Overall Status: ${formatJobStatusLabel(input.job.status)}`, 320, headerBottomY + 50);

  const tolerancePercent = parseTolerancePercent(input.job.configValues?.calibrationTolerancePercent, 2);
  const toleranceMilliamp = (16 * tolerancePercent) / 100;
  const squareRootInTransmitter = String(input.job.configValues?.dpSquareRootLocation ?? '').trim() === 'In Transmitter';
  const outOfToleranceCount =
    input.job.jobType === 'calibration'
      ? input.steps
          .filter((step) => step.inputType === 'number')
          .reduce((count, step) => {
            if (typeof step.valueNumber !== 'number') {
              return count;
            }
            const expected = calculateExpectedMilliamp(step.valueText, input.tag.lrv, input.tag.urv, input.tag.transferFunction, squareRootInTransmitter);
            if (typeof expected !== 'number') {
              return count;
            }
            return Math.abs(step.valueNumber - expected) > toleranceMilliamp ? count + 1 : count;
          }, 0)
      : 0;
  if (input.job.jobType === 'calibration') {
    doc.text(`Calibration Tolerance: ±${tolerancePercent.toFixed(2)}% span (±${toleranceMilliamp.toFixed(3)} mA)`, 320, headerBottomY + 67);
    doc.text(`Out-of-tolerance points: ${outOfToleranceCount}`, 320, headerBottomY + 84);
  }

  const rows = input.steps.map((step, index) => {
    const expected = inferExpected(step, input.tag, squareRootInTransmitter);
    const actual = inferActual(step);
    const status = inferStatus(step, expected, toleranceMilliamp);
    return [String(index + 1), step.title, expected, actual, status];
  });

  autoTable(doc, {
    startY: headerBottomY + 123,
    head: [['Step #', 'Description', 'Expected', 'Actual', 'Status']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] }
  });

  const tableFinalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  let cursorY = Math.max((tableFinalY ?? 0) + 24, headerBottomY + 150);
  doc.setFontSize(12);
  doc.text('Evidence Photos', 40, cursorY);
  cursorY += 12;

  const photoWidth = 240;
  const photoHeight = 135;
  let col = 0;
  for (const group of input.evidence) {
    for (const record of group.records) {
      const x = col === 0 ? 40 : 305;
      if (cursorY + photoHeight + 35 > 780) {
        doc.addPage();
        cursorY = 60;
      }
      const imageData = await blobToDataUrl(record.file);
      doc.addImage(imageData, 'PNG', x, cursorY, photoWidth, photoHeight);
      doc.setFontSize(9);
      doc.text(group.step.title, x, cursorY + photoHeight + 12, { maxWidth: photoWidth });

      col = (col + 1) % 2;
      if (col === 0) {
        cursorY += photoHeight + 28;
      }
    }
  }

  if (col !== 0) {
    cursorY += photoHeight + 28;
  }

  const overallTechNotes = String(input.job.configValues?.overallTechNotes ?? '').trim();
  const notesStep = input.steps.find((step) => (step.templateStepId === 'overall_notes' || step.templateStepId === 'loop_notes') && step.valueText.trim().length > 0);
  const notesText = overallTechNotes || (notesStep?.valueText ?? '').trim();
  if (notesText.length > 0) {
    if (cursorY + 90 > 780) {
      doc.addPage();
      cursorY = 60;
    }
    doc.setFontSize(12);
    doc.text('Overall Tech Notes', 40, cursorY);
    doc.setFontSize(10);
    doc.text(notesText, 40, cursorY + 16, { maxWidth: 520 });
    cursorY += 70;
  }

  const inspectionNotes = input.steps
    .filter(
      (step) =>
        step.inputType === 'passfail' &&
        step.valueText.trim().length > 0 &&
        (step.templateStepId.startsWith('CAL-INSP-') || step.title.startsWith('Inspection:'))
    )
    .map((step) => ({
      stepTitle: step.title,
      result: formatPassFailLabel(step.passFail),
      notes: step.valueText.trim()
    }));

  if (inspectionNotes.length > 0) {
    if (cursorY + 120 > 780) {
      doc.addPage();
      cursorY = 60;
    }

    doc.setFontSize(12);
    doc.text('Inspection Notes (Non-empty)', 40, cursorY);

    autoTable(doc, {
      startY: cursorY + 10,
      head: [['Inspection Step', 'Result', 'Notes']],
      body: inspectionNotes.map((row) => [row.stepTitle, row.result, row.notes]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    cursorY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY) + 18;
  }

  if (input.signature) {
    if (cursorY + 120 > 780) {
      doc.addPage();
      cursorY = 60;
    }
    doc.setFontSize(12);
    doc.text(`Signature (${input.signature.signedBy})`, 40, cursorY);
    const signData = await blobToDataUrl(input.signature.file);
    doc.addImage(signData, 'PNG', 40, cursorY + 10, 220, 90);
    doc.setFontSize(9);
    doc.text(`Signed at: ${input.signature.signedAt || '-'}`, 40, cursorY + 112);
    const sigHashShort = (input.signature.signatureHash || '').slice(0, 12);
    const snapHashShort = (input.signature.jobSnapshotHash || '').slice(0, 12);
    if (sigHashShort || snapHashShort) {
      doc.text(`Signature Hash: ${sigHashShort || '-'}  Job Snapshot Hash: ${snapHashShort || '-'}`, 250, cursorY + 112, { maxWidth: 300 });
    }
    cursorY += 132;
  }

  const completionSnapshotHash = String(input.job.configValues?.completionSnapshotHash ?? '');
  const signatureInvalidatedAt = String(input.job.configValues?.signatureInvalidatedAt ?? '');
  if (cursorY + 120 > 780) {
    doc.addPage();
    cursorY = 60;
  }
  doc.setFontSize(12);
  doc.text('Verification Summary', 40, cursorY);
  doc.setFontSize(10);
  doc.text(`Completion Snapshot Hash: ${completionSnapshotHash || 'Not recorded'}`, 40, cursorY + 16, { maxWidth: 520 });
  doc.text(`Signature Hash: ${input.signature?.signatureHash || 'Not signed'}`, 40, cursorY + 32, { maxWidth: 520 });
  doc.text(`Job Snapshot Hash At Signature: ${input.signature?.jobSnapshotHash || 'Not signed'}`, 40, cursorY + 48, { maxWidth: 520 });
  doc.text(`Record changed after signature: ${signatureInvalidatedAt ? `YES (${signatureInvalidatedAt})` : 'No'}`, 40, cursorY + 64, { maxWidth: 520 });
  doc.text('Use these hashes to verify report integrity and sign-off timing.', 40, cursorY + 80, { maxWidth: 520 });

  doc.save(`${input.tag.tagNumber}_Job_${input.job.id}.pdf`);
}

function inferExpected(step: StepEntity, tag: TagEntity, squareRootInTransmitter: boolean): string {
  if (step.inputType === 'number') {
    const expected = calculateExpectedMilliamp(step.valueText, tag.lrv, tag.urv, tag.transferFunction, squareRootInTransmitter);
    return typeof expected === 'number' ? expected.toFixed(3) : '-';
  }
  if (step.inputType === 'passfail') {
    return 'Pass';
  }
  return 'Note Required';
}

function inferActual(step: StepEntity): string {
  if (step.inputType === 'number') {
    return typeof step.valueNumber === 'number' ? `${step.valueNumber}${step.unit ? ` ${step.unit}` : ''}` : '-';
  }
  if (step.inputType === 'passfail') {
    return step.passFail ? formatPassFailLabel(step.passFail) : '-';
  }
  return step.valueText || '-';
}

function inferStatus(step: StepEntity, expected: string, toleranceMilliamp: number): string {
  if (step.inputType === 'passfail') {
    return step.passFail ? formatPassFailLabel(step.passFail) : 'Pending';
  }
  if (step.inputType === 'number') {
    if (typeof step.valueNumber !== 'number') {
      return 'Pending';
    }
    const expectedValue = parseNumericInput(expected);
    if (typeof expectedValue !== 'number') {
      return 'Entered';
    }
    const deviation = Math.abs(step.valueNumber - expectedValue);
    return deviation > toleranceMilliamp ? `Out of Tol (>±${toleranceMilliamp.toFixed(3)} mA)` : 'Within Tol';
  }
  return step.valueText.trim().length > 0 ? 'Entered' : 'Pending';
}

function parseTolerancePercent(raw: unknown, defaultPercent: number): number {
  const normalized = String(raw ?? '').trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultPercent;
  }
  return parsed;
}

async function renderBrandingHeader(doc: jsPDF, companyName: string, logoDataUrl: string, letterheadDataUrl: string): Promise<number> {
  if (letterheadDataUrl) {
    try {
      doc.addImage(letterheadDataUrl, inferImageFormat(letterheadDataUrl), 40, 24, 515, 58);
      return 86;
    } catch {
      // fall through to text/logo header
    }
  }

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, inferImageFormat(logoDataUrl), 40, 28, 120, 40);
      doc.setFontSize(16);
      doc.text(companyName || 'Company', 170, 52);
      return 78;
    } catch {
      // fall through to text-only header
    }
  }

  doc.setFontSize(18);
  doc.text(companyName || 'Company', 40, 50);
  return 60;
}

function inferImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
    return 'JPEG';
  }
  return 'PNG';
}

function formatPassFailLabel(value: StepEntity['passFail']): string {
  if (value === 'pass') {
    return 'Pass';
  }
  if (value === 'fail') {
    return 'Fail';
  }
  if (value === 'na') {
    return 'N/A';
  }
  return 'Pending';
}

function formatJobStatusLabel(status: JobEntity['status']): string {
  if (status === 'in-progress') {
    return 'In-Progress';
  }
  if (status === 'suspended') {
    return 'Suspended';
  }
  if (status === 'cancelled') {
    return 'Cancelled';
  }
  return 'Completed';
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== 'string') {
        reject(new Error('Failed to convert blob to data url.'));
        return;
      }
      resolve(value);
    };
    reader.onerror = () => reject(new Error('Blob read failed.'));
    reader.readAsDataURL(blob);
  });
}
