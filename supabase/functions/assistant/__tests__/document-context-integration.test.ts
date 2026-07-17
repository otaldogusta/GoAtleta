import { readFileSync } from "node:fs";
import path from "node:path";

const assistantSource = readFileSync(
  path.resolve(__dirname, "..", "index.ts"),
  "utf8"
);

describe("assistant unified document context", () => {
  test("usa o resolvedor compartilhado em vez de uma recuperação paralela", () => {
    expect(assistantSource).toContain("resolveAIDocumentContext");
    expect(assistantSource).toContain("buildSystemAIDocumentContextPrompt");
    expect(assistantSource).not.toContain('.from("kb_documents")');
    expect(assistantSource).not.toContain("getKnowledgeDocuments");
    expect(assistantSource).not.toContain("SCIENTIFIC_EVIDENCE_CONTEXT");
    expect(assistantSource).not.toContain("RAG_CONTEXT");
  });

  test("integra memória e periodização ao mesmo contexto documental", () => {
    expect(assistantSource).toContain(
      "resolveAIDocumentContext(\n      supabase,\n      aiContext,\n      aiFacts,"
    );
    expect(assistantSource).toContain("periodization: aiPeriodization");
    expect(assistantSource).not.toContain("buildSystemAIPeriodizationPrompt");
  });

  test("valida citações contra os documentos realmente recuperados", () => {
    expect(assistantSource).toContain("validateAIDocumentCitations(");
    expect(assistantSource).toContain("aiDocuments");
  });
});
