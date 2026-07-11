import {
  assertSafeDocumentSourceUrl,
  classifyDocumentSync,
  ingestDocumentSource,
  normalizeDocumentContent,
  type DocumentSourceRecord,
} from "..";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const baseSource: DocumentSourceRecord = {
  id: "source-1",
  organizationId: "org-1",
  provider: "google_drive",
  externalId: "doc-1",
  externalRevisionId: "rev-1",
  filename: "planejamento.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  contentHash: HASH_A,
};

describe("document intelligence ingestion", () => {
  it("normalizes line endings and trailing whitespace before hashing", () => {
    expect(normalizeDocumentContent("\uFEFFPlano  \r\nJulho\t\r\n")).toBe("Plano\nJulho");
  });

  it("creates a scoped source record without interpreting pedagogical content", async () => {
    const result = await ingestDocumentSource(
      {
        id: "source-1",
        organizationId: "org-1",
        classId: "class-1",
        provider: "pasted_text",
        filename: "texto.txt",
        mimeType: "text/plain",
        content: "  Planejamento de julho  ",
      },
      {
        sha256: async (content) => {
          expect(content).toBe("Planejamento de julho");
          return HASH_A;
        },
        classBelongsToOrganization: async () => true,
      }
    );

    expect(result.syncStatus).toBe("created");
    expect(result.source).toMatchObject({
      organizationId: "org-1",
      classId: "class-1",
      contentHash: HASH_A,
    });
  });

  it("requires server-side class membership validation", async () => {
    await expect(
      ingestDocumentSource(
        {
          id: "source-1",
          organizationId: "org-1",
          classId: "class-2",
          provider: "pasted_text",
          filename: "texto.txt",
          mimeType: "text/plain",
          content: "conteúdo",
        },
        { sha256: async () => HASH_A }
      )
    ).rejects.toThrow(/pertencimento da turma/);
  });

  it("detects unchanged revisions and updated content", () => {
    expect(classifyDocumentSync({ ...baseSource }, baseSource)).toBe("unchanged");
    expect(
      classifyDocumentSync(
        { ...baseSource, externalRevisionId: "rev-2", contentHash: HASH_B },
        baseSource
      )
    ).toBe("updated");
  });

  it("blocks cross-workspace comparisons", () => {
    expect(() =>
      classifyDocumentSync({ ...baseSource, organizationId: "org-2" }, baseSource)
    ).toThrow(/workspaces diferentes/);
  });

  it.each([
    "http://localhost/documento",
    "http://127.0.0.1/documento",
    "http://10.0.0.4/documento",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/documento",
    "file:///tmp/documento",
  ])("blocks unsafe source URL %s", (sourceUrl) => {
    expect(() => assertSafeDocumentSourceUrl(sourceUrl)).toThrow();
  });

  it("accepts a public HTTPS source URL", () => {
    expect(assertSafeDocumentSourceUrl("https://docs.google.com/document/d/123").hostname).toBe(
      "docs.google.com"
    );
  });
});
