export const DEFAULT_DOCUMENT_SYNC_BATCH_SIZE = 1;
export const MAX_DOCUMENT_SYNC_BATCH_SIZE = 1;

const finiteInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
};

export const normalizeDocumentSyncCursor = (value: unknown) =>
  Math.max(0, finiteInteger(value, 0));

export const normalizeDocumentSyncBatchSize = (value: unknown) =>
  Math.max(
    1,
    Math.min(
      finiteInteger(value, DEFAULT_DOCUMENT_SYNC_BATCH_SIZE),
      MAX_DOCUMENT_SYNC_BATCH_SIZE,
    ),
  );

export const planDocumentSyncBatch = <T>(params: {
  items: T[];
  cursor?: unknown;
  batchSize?: unknown;
}) => {
  const cursor = Math.min(
    normalizeDocumentSyncCursor(params.cursor),
    params.items.length,
  );
  const batchSize = normalizeDocumentSyncBatchSize(params.batchSize);
  const end = Math.min(cursor + batchSize, params.items.length);
  const hasMore = end < params.items.length;

  return {
    cursor,
    batchSize,
    items: params.items.slice(cursor, end),
    processedThrough: end,
    hasMore,
    nextCursor: hasMore ? end : null,
  };
};
