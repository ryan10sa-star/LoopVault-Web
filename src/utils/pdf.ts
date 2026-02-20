export interface PdfJobSummary {
  jobId: string;
  title: string;
}

export async function generateJobPdf(_job: PdfJobSummary): Promise<void> {
  throw new Error('PDF scaffold only. Implement generation in next task.');
}
