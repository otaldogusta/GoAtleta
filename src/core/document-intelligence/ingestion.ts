import {
  assertDocumentOrganizationScope,
  assertSafeDocumentSourceUrl,
} from "./security";
import type {
  DocumentIngestionInput,
  DocumentIngestionResult,
  DocumentSourceRecord,
  DocumentSyncStatus,
} from "./types";

export type DocumentIngestionDependencies = {
  sha256(content: string): Promise<string>;
  classBelongsToOrganization?(params: {
    organizationId: string;
    classId: string;
  }): Promise<boolean>;
};

export function normalizeDocumentContent(content: string): string {
  return content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/g, ""))
    .join("\n")
    .trim();
}
export function classifyDocumentSync(
  next: DocumentSourceRecord,
  previous?: DocumentSourceRecord | null
): DocumentSyncStatus {
  if (!previous) return "created";
  if (previous.organizationId !== next.organizationId) {
    throw new Error("Não é permitido comparar documentos de workspaces diferentes.");
  }
  if (
    previous.contentHash === next.contentHash &&
    previous.externalRevisionId === next.externalRevisionId
  ) {
    return "unchanged";
  }
  return "updated";
}

export async function ingestDocumentSource(
  input: DocumentIngestionInput,
  dependencies: DocumentIngestionDependencies,
  previous?: DocumentSourceRecord | null
): Promise<DocumentIngestionResult> {
  assertDocumentOrganizationScope(input.organizationId);
  if (!input.id.trim()) throw new Error("id da fonte é obrigatório.");
  if (!input.filename.trim()) throw new Error("filename é obrigatório.");
  if (!input.mimeType.trim()) throw new Error("mimeType é obrigatório.");
  if (input.provider === "url") {
    if (!input.sourceUrl) throw new Error("sourceUrl é obrigatória para fontes URL.");
    assertSafeDocumentSourceUrl(input.sourceUrl);
  }
  if (input.classId) {
    if (!dependencies.classBelongsToOrganization) {
      throw new Error("A validação de pertencimento da turma é obrigatória.");
    }
    const belongs = await dependencies.classBelongsToOrganization({
      organizationId: input.organizationId,
      classId: input.classId,
    });
    if (!belongs) throw new Error("A turma não pertence ao workspace informado.");
  }

  const normalizedContent = normalizeDocumentContent(input.content);
  if (!normalizedContent) throw new Error("O documento não possui conteúdo legível.");
  const contentHash = await dependencies.sha256(normalizedContent);
  if (!/^[a-f0-9]{64}$/i.test(contentHash)) {
    throw new Error("O adaptador sha256 retornou um hash inválido.");
  }

  const source: DocumentSourceRecord = {
    id: input.id,
    organizationId: input.organizationId,
    programId: input.programId,
    modalityId: input.modalityId,
    classId: input.classId,
    provider: input.provider,
    externalId: input.externalId,
    externalRevisionId: input.externalRevisionId,
    sourceUrl: input.sourceUrl,
    filename: input.filename,
    mimeType: input.mimeType,
    contentHash: contentHash.toLowerCase(),
    modifiedAt: input.modifiedAt,
  };

  return {
    source,
    normalizedContent,
    syncStatus: classifyDocumentSync(source, previous),
  };
}
