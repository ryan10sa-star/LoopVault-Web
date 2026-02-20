import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EvidenceEntity, JobEntity, SignatureEntity, StepEntity, TagEntity } from '../db';

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

  doc.setFontSize(18);
  doc.text('Company Name (Placeholder)', 40, 50);

  doc.setFontSize(11);
  doc.text(`Tag: ${input.tag.tagNumber}`, 40, 75);
  doc.text(`Date: ${createdAt}`, 40, 92);
  doc.text(`Tech Name: ${input.job.techName}`, 40, 109);

  doc.text(`Job Type: ${input.job.jobType}`, 320, 75);
  doc.text(`Overall Status: ${input.job.status}`, 320, 92);

  const rows = input.steps.map((step, index) => {
    const expected = inferExpected(step);
    const actual = inferActual(step);
    const status = inferStatus(step);
    return [String(index + 1), step.title, expected, actual, status];
  });

  autoTable(doc, {
    startY: 130,
    head: [['Step #', 'Description', 'Expected', 'Actual', 'Status']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] }
  });

  let cursorY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 130) + 24;
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
    doc.text(`Signed at: ${new Date().toISOString()}`, 40, cursorY + 112);
  }

  doc.save(`${input.tag.tagNumber}_Job_${input.job.id}.pdf`);
}

function inferExpected(step: StepEntity): string {
  if (step.inputType === 'number') {
    return step.unit ? `Target (${step.unit})` : 'Target';
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
    return step.passFail || '-';
  }
  return step.valueText || '-';
}

function inferStatus(step: StepEntity): string {
  if (step.inputType === 'passfail') {
    return step.passFail || 'pending';
  }
  if (step.inputType === 'number') {
    return typeof step.valueNumber === 'number' ? 'entered' : 'pending';
  }
  return step.valueText.trim().length > 0 ? 'entered' : 'pending';
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
