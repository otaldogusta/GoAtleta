import { readFileSync } from "node:fs";
import path from "node:path";

const routeSource = readFileSync(
  path.resolve(
    __dirname,
    "..",
    "..",
    "document-context-resolve",
    "index.ts"
  ),
  "utf8"
);

describe("document-context-resolve public contract", () => {
  test("retorna somente uma projeção segura do documento", () => {
    expect(routeSource).toContain(
      "documents: resolved.documents.map(publicDocumentPayload)"
    );
    expect(routeSource).not.toContain("documents: resolved.documents,");
    expect(routeSource).toContain("publicDocumentMetadata");
    expect(routeSource).toContain(
      "document.sourceExcerpt || document.chunk"
    );
    expect(routeSource).toContain('"Google Drive"');
  });
});
