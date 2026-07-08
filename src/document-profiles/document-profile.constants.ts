export const DOCUMENT_TYPE_OPTIONS = [
  'ANY',
  'PDF',
  'IMAGE',
  'JPEG',
  'PNG',
  'DOC',
  'XLS',
] as const;

export type DocumentTypeOption = (typeof DOCUMENT_TYPE_OPTIONS)[number];

