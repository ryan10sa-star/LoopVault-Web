export const MIN_LIFECYCLE_NOTE_WORDS = 5;

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_TAG = 10;
export const MAX_DOCUMENT_BYTES_PER_TAG = 30 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES_GLOBAL = 300 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);