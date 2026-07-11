export type DocumentSourceProvider =
  | "google_drive"
  | "upload"
  | "url"
  | "pasted_text";

export type DocumentSourceRecord = {
  id: string;
  organizationId: string;
  programId?: string;
  modalityId?: string;
  classId?: string;
  provider: DocumentSourceProvider;
  externalId?: string;
  externalRevisionId?: string;
  sourceUrl?: string;
  filename: string;
  mimeType: string;
  contentHash: string;
  modifiedAt?: string;
};
export type DocumentContextInput = Pick<
  DocumentSourceRecord,
  "organizationId" | "programId" | "modalityId" | "classId"
>;

export type DocumentIngestionInput = DocumentContextInput & {
  id: string;
  provider: DocumentSourceProvider;
  content: string;
  filename: string;
  mimeType: string;
  externalId?: string;
  externalRevisionId?: string;
  sourceUrl?: string;
  modifiedAt?: string;
};

export type DocumentSyncStatus = "created" | "unchanged" | "updated";

export type DocumentIngestionResult = {
  source: DocumentSourceRecord;
  normalizedContent: string;
  syncStatus: DocumentSyncStatus;
};
