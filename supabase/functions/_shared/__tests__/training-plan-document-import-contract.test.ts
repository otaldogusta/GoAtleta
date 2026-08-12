import { readFileSync } from "node:fs";
import path from "node:path";

const functionSource = readFileSync(
  path.resolve(__dirname, "..", "..", "training-plan-document-import", "index.ts"),
  "utf8",
);

describe("training plan document import persistence contract", () => {
  test("sends the Responses API a PDF data URL through input_file", () => {
    expect(functionSource).toContain("data:application/pdf;base64,${base64}");
  });

  test("classifies upstream failures and gives rate limiting an actionable state", () => {
    expect(functionSource).toContain("new OpenAiRequestError");
    expect(functionSource).toContain("resolveOpenAiRetryDelayMs");
    expect(functionSource).toContain('createImportError(429, "AI_RATE_LIMITED"');
    expect(functionSource).toContain('createImportError(429, "AI_QUOTA_EXCEEDED"');
    expect(functionSource).toContain("retryAfterSeconds");
    expect(functionSource).toContain('createError(502, "AI_ANALYSIS_FAILED"');
  });

  test("reuses completed analysis and serializes concurrent work by content hash", () => {
    expect(functionSource).toContain('PARSER_VERSION = "planning-pdf-multimodal-v5"');
    expect(functionSource).toContain("ANALYZING:${Date.now()}");
    expect(functionSource).toContain('"ANALYSIS_IN_PROGRESS"');
    expect(functionSource).toContain("loadCachedInterpretation");
    expect(functionSource).toContain("cacheHit: true");
    expect(functionSource).toContain('.eq("error_code", revision.error_code)');
  });

  test("splits long PDFs into bounded page batches and returns processing progress", () => {
    expect(functionSource).toContain("PDFDocument.load");
    expect(functionSource).toContain("buildPdfPageBatches");
    expect(functionSource).toContain("createPdfBatchBase64");
    expect(functionSource).toContain("LARGE_PDF_PAGE_THRESHOLD = 3");
    expect(functionSource).toContain("PDF_BATCH_SIZE = 1");
    expect(functionSource).toContain("PDF_BATCH_OVERLAP = 0");
    expect(functionSource).toContain('OPENAI_DOCUMENT_MODEL") || "gpt-4o-mini"');
    expect(functionSource).toContain("persistedPdfBatchesFromProvenance");
    expect(functionSource).toContain("onBatchComplete");
    expect(functionSource).toContain("partialBatches: persistedBatches");
    expect(functionSource).toContain("ANALYSIS_SLICE_MS = 80_000");
    expect(functionSource).toContain('"ANALYSIS_IN_PROGRESS"');
    expect(functionSource).toContain("processing,");
  });

  test("keeps import class-independent and defers binding until apply", () => {
    expect(functionSource).toContain('classBinding: "deferred_until_apply"');
    expect(functionSource).toContain('const bindingStatus = classRow ? "confirmed" as const : "unresolved" as const');
    expect(functionSource).toContain("if (!classRow) {");
    expect(functionSource).toContain('selectedClassName: ""');
    expect(functionSource).toContain("no class plan or merge");
  });

  test("still persists an explicitly selected class as an idempotent confirmed binding", () => {
    expect(functionSource).toContain(
      "`${organizationId}|${interpretationRow.id}|${classId}`",
    );
    expect(functionSource).toContain('source_profile: "lesson_plan"');
    expect(functionSource).toContain('folder_role: "lesson_plan"');
    expect(functionSource).toContain("month_key: bindingPeriod");
    expect(functionSource).toContain("binding_key: bindingKey");
    expect(functionSource).toContain('{ onConflict: "binding_key" }');
    expect(functionSource).toContain("confirmed_by: user.id");
  });

  test("keeps an extracted class-name mismatch visible for human review", () => {
    expect(functionSource).toContain("!classMatches && extractedClassName");
    expect(functionSource).toContain("mas será vinculado à turma selecionada");
  });
});
