export type PdfPageBatch = {
  pageStart: number;
  pageEnd: number;
};

export const normalizePdfSourceLocation = (value: string, batch: PdfPageBatch) => {
  const batchLength = batch.pageEnd - batch.pageStart + 1;
  return value.replace(/\b(?:p[aá]gina|page|p\.)\s*(\d+)\b/gi, (_match, rawPage: string) => {
    const reportedPage = Math.max(1, Math.floor(Number(rawPage) || 1));
    const pageIsAlreadyAbsolute = reportedPage > batchLength &&
      reportedPage >= batch.pageStart &&
      reportedPage <= batch.pageEnd;
    const absolutePage = pageIsAlreadyAbsolute
      ? reportedPage
      : batch.pageStart + Math.min(batchLength, reportedPage) - 1;
    return `Página ${absolutePage}`;
  });
};

const parseDurationMs = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return 0;
  if (/^\d+(?:\.\d+)?$/.test(normalized)) return Math.ceil(Number(normalized) * 1000);

  let total = 0;
  const parts = normalized.matchAll(/(\d+(?:\.\d+)?)\s*(ms|s|m)/g);
  for (const part of parts) {
    const amount = Number(part[1]);
    if (!Number.isFinite(amount)) continue;
    total += part[2] === "m" ? amount * 60_000 : part[2] === "s" ? amount * 1000 : amount;
  }
  return Math.ceil(total);
};

export const resolveOpenAiRetryDelayMs = (headers: {
  retryAfter?: string | null;
  resetRequests?: string | null;
  resetTokens?: string | null;
}) => {
  const candidates = [
    parseDurationMs(headers.retryAfter),
    parseDurationMs(headers.resetRequests),
    parseDurationMs(headers.resetTokens),
  ].filter((value) => value > 0);
  return candidates.length ? Math.max(...candidates) : 15_000;
};

export const isRetryableOpenAiRateLimit = (code?: string | null) => {
  const normalized = String(code ?? "").trim().toLowerCase();
  return ![
    "insufficient_quota",
    "billing_hard_limit_reached",
    "billing_not_active",
  ].includes(normalized);
};

export const buildPdfPageBatches = ({
  pageCount,
  batchSize = 4,
  overlap = 1,
}: {
  pageCount: number;
  batchSize?: number;
  overlap?: number;
}): PdfPageBatch[] => {
  const safePageCount = Math.max(1, Math.floor(pageCount));
  const safeBatchSize = Math.max(1, Math.floor(batchSize));
  const safeOverlap = Math.max(0, Math.min(safeBatchSize - 1, Math.floor(overlap)));
  if (safePageCount <= safeBatchSize) return [{ pageStart: 1, pageEnd: safePageCount }];

  const batches: PdfPageBatch[] = [];
  let pageStart = 1;
  while (pageStart <= safePageCount) {
    const pageEnd = Math.min(safePageCount, pageStart + safeBatchSize - 1);
    batches.push({ pageStart, pageEnd });
    if (pageEnd >= safePageCount) break;
    pageStart = pageEnd - safeOverlap + 1;
  }
  return batches;
};
