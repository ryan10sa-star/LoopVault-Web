import { PDFDocument } from 'pdf-lib';

export const BYOF_STANDARD_FIELD_MAP = {
  testEquipment: 'testEquipment',
  testEquipmentCalDate: 'testEquipmentCalDate',
  instrumentRole: 'instrumentRole',
  safetyLayer: 'safetyLayer',
  votingLogic: 'votingLogic',
  controlSystem: 'controlSystem',
  silTarget: 'silTarget',
  proofTestInterval: 'proofTestInterval',
  bypassPermitRequired: 'bypassPermitRequired',
  functionalOwner: 'functionalOwner',
  boardOperator: 'board_operator',
  controllerSystem: 'controller_type',
  testScope: 'test_type',
  exceptionsAndFieldNotes: 'overall_notes',
  asFound50Actual: 'as_found_50_actual'
} as const;

export type ByofStandardFieldName = keyof typeof BYOF_STANDARD_FIELD_MAP;

export interface GenerateCustomPdfInput {
  templateBytes: Uint8Array;
  fieldValues: Record<string, string | number | null | undefined>;
}

export async function validatePdfTemplateUpload(file: File): Promise<Uint8Array | null> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!looksLikePdf(bytes)) {
      throw new Error('Not a valid PDF header.');
    }
    await PDFDocument.load(bytes, { ignoreEncryption: false });
    return bytes;
  } catch {
    window.alert('Invalid or corrupted PDF.');
    return null;
  }
}

export async function generateCustomPdf(input: GenerateCustomPdfInput): Promise<Blob | null> {
  try {
    const pdfDoc = await PDFDocument.load(input.templateBytes, { ignoreEncryption: false });
    const form = pdfDoc.getForm();
    const availableFields = new Set(form.getFields().map((field) => field.getName()));

    for (const [name, rawValue] of Object.entries(input.fieldValues)) {
      if (!availableFields.has(name)) {
        continue;
      }
      try {
        const textField = form.getTextField(name);
        textField.setText(stringifyFieldValue(rawValue));
      } catch {
        continue;
      }
    }

    const bytes = await pdfDoc.save();
    const blobBytes = Uint8Array.from(bytes);
    return new Blob([blobBytes], { type: 'application/pdf' });
  } catch {
    window.alert('Invalid or corrupted PDF.');
    return null;
  }
}

function looksLikePdf(bytes: Uint8Array): boolean {
  if (bytes.length < 4) {
    return false;
  }
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function stringifyFieldValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}
