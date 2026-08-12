import {
  buildPdfPageBatches,
  isRetryableOpenAiRateLimit,
  normalizePdfSourceLocation,
  resolveOpenAiRetryDelayMs,
} from "../training-plan-import-resilience";

describe("training plan import resilience", () => {
  it("keeps small PDFs in one request", () => {
    expect(buildPdfPageBatches({ pageCount: 4 })).toEqual([{ pageStart: 1, pageEnd: 4 }]);
  });

  it("splits large PDFs with one overlapping boundary page", () => {
    expect(buildPdfPageBatches({ pageCount: 10 })).toEqual([
      { pageStart: 1, pageEnd: 4 },
      { pageStart: 4, pageEnd: 7 },
      { pageStart: 7, pageEnd: 10 },
    ]);
  });

  it("can isolate every page for the lowest-load extraction profile", () => {
    expect(buildPdfPageBatches({ pageCount: 4, batchSize: 1, overlap: 0 })).toEqual([
      { pageStart: 1, pageEnd: 1 },
      { pageStart: 2, pageEnd: 2 },
      { pageStart: 3, pageEnd: 3 },
      { pageStart: 4, pageEnd: 4 },
    ]);
  });

  it("maps page-local evidence back to the original PDF page", () => {
    expect(normalizePdfSourceLocation("Página 1, Objetivo geral", { pageStart: 6, pageEnd: 6 }))
      .toBe("Página 6, Objetivo geral");
    expect(normalizePdfSourceLocation("Page 2", { pageStart: 6, pageEnd: 7 }))
      .toBe("Página 7");
    expect(normalizePdfSourceLocation("Página 6", { pageStart: 6, pageEnd: 7 }))
      .toBe("Página 6");
  });

  it("uses the longest upstream reset signal", () => {
    expect(resolveOpenAiRetryDelayMs({
      retryAfter: "2",
      resetRequests: "1.5s",
      resetTokens: "12s",
    })).toBe(12_000);
  });

  it("does not retry exhausted billing quota", () => {
    expect(isRetryableOpenAiRateLimit("rate_limit_exceeded")).toBe(true);
    expect(isRetryableOpenAiRateLimit("insufficient_quota")).toBe(false);
  });
});
