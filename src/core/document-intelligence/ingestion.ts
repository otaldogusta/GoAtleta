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
  programBelongsToOrganization?(params: {
    organizationId: string;
    programId: string;
  }): Promise<boolean>;
  modalityBelongsToOrganization?(params: {
    organizationId: string;
    modalityId: string;
  }): Promise<boolean>;
  classBelongsToOrganization?(params: {
    organizationId: string;
    classId: string;
  }): Promise<boolean>;
};

function assertSameDocumentSource(
  previous: DocumentSourceRecord,
  next: DocumentSourceRecord
) {
  const sameInternalId = previous.id === next.id;
  const sameExternalSource = Boolean(
    previous.provider === next.provider &&
      previous.externalId &&
      previous.externalId === next.externalId
  );
  if (!sameInternalId && !sameExternalSource) {
    throw new Error("Não é permitido comparar fontes documentais diferentes.");
  }
}

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
  assertSameDocumentSource(previous, next);
  if (previous.contentHash === next.contentHash) return "unchanged";
  return "updated";
}

async function assertOptionalContextBelongsToOrganization(params: {
  organizationId: string;
  contextName: "programa" | "modalidade" | "turma";
  contextArticle: "do" | "da";
  contextId?: string;
  validate?: (scope: { organizationId: string; contextId: string }) => Promise<boolean>;
}) {
  if (!params.contextId) return;
  if (!params.validate) {
    throw new Error(
      `A validação de pertencimento ${params.contextArticle} ${params.contextName} é obrigatória.`
    );
  }
  const belongs = await params.validate({
    organizationId: params.organizationId,
    contextId: params.contextId,
  });
  if (!belongs) {
    throw new Error(`${params.contextName} não pertence ao workspace informado.`);
  }
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
  await assertOptionalContextBelongsToOrganization({
    organizationId: input.organizationId,
    contextName: "programa",
    contextArticle: "do",
    contextId: input.programId,
    validate: dependencies.programBelongsToOrganization
      ? ({ organizationId, contextId }) =>
          dependencies.programBelongsToOrganization!({ organizationId, programId: contextId })
      : undefined,
  });
  await assertOptionalContextBelongsToOrganization({
    organizationId: input.organizationId,
    contextName: "modalidade",
    contextArticle: "da",
    contextId: input.modalityId,
    validate: dependencies.modalityBelongsToOrganization
      ? ({ organizationId, contextId }) =>
          dependencies.modalityBelongsToOrganization!({ organizationId, modalityId: contextId })
      : undefined,
  });
  await assertOptionalContextBelongsToOrganization({
    organizationId: input.organizationId,
    contextName: "turma",
    contextArticle: "da",
    contextId: input.classId,
    validate: dependencies.classBelongsToOrganization
      ? ({ organizationId, contextId }) =>
          dependencies.classBelongsToOrganization!({ organizationId, classId: contextId })
      : undefined,
  });

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
