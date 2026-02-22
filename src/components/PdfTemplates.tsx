import { useState } from 'react';
import { generateCustomPdf, validatePdfTemplateUpload } from '../utils/pdfExportEngine';

export function PdfTemplates(): JSX.Element {
  const [status, setStatus] = useState<string>('');

  const onTemplateSelected = async (event: { currentTarget: HTMLInputElement }): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    const bytes = await validatePdfTemplateUpload(file);
    if (!bytes) {
      setStatus('Template rejected.');
      return;
    }

    const previewResult = await generateCustomPdf({
      templateBytes: bytes,
      fieldValues: {
        testEquipmentCalDate: '2026-12-31',
        as_found_50_actual: '12.01'
      }
    });

    if (!previewResult) {
      setStatus('Template validation failed.');
      return;
    }

    setStatus('Template validated and ready for BYOF export.');
    event.currentTarget.value = '';
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
      <h3 className="text-lg font-semibold">Custom PDF Template</h3>
      <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border border-slate-400 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
        Upload PDF Template
        <input accept=".pdf,application/pdf" className="hidden" onChange={(event) => void onTemplateSelected(event)} type="file" />
      </label>
      {status ? <p className="text-sm text-slate-200">{status}</p> : null}
    </section>
  );
}
