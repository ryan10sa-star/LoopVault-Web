export interface TagScannerResult {
  value: string;
}

export async function useTagScanner(): Promise<TagScannerResult> {
  throw new Error('Scanner scaffold only. Implement camera pipeline in next task.');
}
