import {
  MAX_DOCUMENT_SYNC_BATCH_SIZE,
  normalizeDocumentSyncBatchSize,
  normalizeDocumentSyncCursor,
  planDocumentSyncBatch,
} from "../document-sync-batch";

describe("document sync batching", () => {
  test("processa lotes pequenos e fornece cursor retomável", () => {
    const first = planDocumentSyncBatch({
      items: ["a", "b", "c", "d", "e"],
      cursor: 0,
      batchSize: 2,
    });
    const second = planDocumentSyncBatch({
      items: ["a", "b", "c", "d", "e"],
      cursor: first.nextCursor,
      batchSize: 2,
    });

    expect(first).toMatchObject({
      items: ["a"],
      nextCursor: 1,
      hasMore: true,
    });
    expect(second).toMatchObject({
      items: ["b"],
      nextCursor: 2,
      hasMore: true,
    });
  });

  test("encerra sem repetir itens no último lote", () => {
    expect(
      planDocumentSyncBatch({
        items: ["a", "b", "c"],
        cursor: 2,
        batchSize: 4,
      }),
    ).toMatchObject({
      items: ["c"],
      processedThrough: 3,
      nextCursor: null,
      hasMore: false,
    });
  });

  test("normaliza cursores e impede lotes grandes no Edge Runtime", () => {
    expect(normalizeDocumentSyncCursor(-20)).toBe(0);
    expect(normalizeDocumentSyncCursor("3")).toBe(3);
    expect(normalizeDocumentSyncBatchSize(999)).toBe(
      MAX_DOCUMENT_SYNC_BATCH_SIZE,
    );
    expect(normalizeDocumentSyncBatchSize(0)).toBe(1);
  });
});
