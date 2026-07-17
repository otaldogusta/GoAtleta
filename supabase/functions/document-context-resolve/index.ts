import {
  createEdgeFunction,
  createError,
  createSuccess,
} from "../_shared/framework.ts";
import { resolveAIContext } from "../_shared/ai-context.ts";
import { resolveAIMemory } from "../_shared/ai-memory.ts";
import {
  resolveAIDocumentContext,
  type AIDocument,
} from "../_shared/ai-document-context.ts";
import { resolveAIPeriodizationContext } from "../_shared/ai-periodization-context.ts";

type DocumentContextResolveRequest = {
  organizationId?: string;
  classId?: string;
  actionDate?: string;
  queryText?: string;
  sportHint?: string;
  maxDocuments?: number;
};

const textValue = (value: unknown, max = 1_200) =>
  String(value ?? "").trim().slice(0, max);

const clampMaxDocuments = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 8;
  return Math.max(1, Math.min(12, Math.floor(parsed)));
};

const publicDocumentMetadata = (metadata: Record<string, unknown>) => ({
  documentClass:
    metadata.documentClass ?? metadata.document_class ?? null,
  documentType: metadata.documentType ?? metadata.document_type ?? null,
  folderRole: metadata.folderRole ?? metadata.folder_role ?? null,
  sourceProfile: metadata.sourceProfile ?? metadata.source_profile ?? null,
  monthKey: metadata.monthKey ?? metadata.month_key ?? null,
  documentDate: metadata.documentDate ?? metadata.document_date ?? null,
  sourceLabel: metadata.sourceLabel ?? metadata.source_label ?? null,
});

const publicDocumentPayload = (document: AIDocument) => {
  const rawSource = textValue(document.source, 260);
  const sourceLabel =
    document.originKind === "app_state"
      ? rawSource
      : textValue(document.institution, 180) ||
        textValue(document.author, 180) ||
        (/^https?:\/\//i.test(rawSource) ? "Google Drive" : rawSource) ||
        "Contexto documental";

  return {
    id: document.id,
    originKind: document.originKind,
    layer: document.layer,
    sourceScope: document.sourceScope,
    title: textValue(document.title, 260),
    source: sourceLabel,
    sourceExcerpt: textValue(
      document.sourceExcerpt || document.chunk,
      900
    ),
    sourceLocation: textValue(document.sourceLocation, 260),
    effectiveDate: document.effectiveDate,
    confidence: document.confidence,
    discipline: textValue(document.discipline, 180),
    academicArea: textValue(document.academicArea, 120),
    materialType: textValue(document.materialType, 80),
    evidenceKind: textValue(document.evidenceKind, 80),
    author: textValue(document.author, 180),
    institution: textValue(document.institution, 180),
    academicPeriod: textValue(document.academicPeriod, 80),
    sourceDocumentId: document.sourceDocumentId || document.id,
    sourceRevisionId: textValue(document.sourceRevisionId, 180),
    contentHash: textValue(document.contentHash, 80),
    metadata: publicDocumentMetadata(document.metadata),
  };
};

Deno.serve(
  createEdgeFunction<DocumentContextResolveRequest>({
    name: "document-context-resolve",
    requireAuth: true,
    parseJson: true,
    handler: async ({ user, body, supabase }) => {
      if (!user) return createError(401, "UNAUTHORIZED", "Sessão inválida.");

      const organizationId = textValue(body?.organizationId, 128);
      const queryText = textValue(body?.queryText);
      if (!organizationId) {
        return createError(
          400,
          "BAD_REQUEST",
          "organizationId é obrigatório."
        );
      }
      if (!queryText) {
        return createSuccess({
          status: "ready",
          actionDate: textValue(body?.actionDate, 10),
          documents: [],
          retrieval: {
            cacheHit: false,
            latencyMs: 0,
          },
        });
      }

      const classId = textValue(body?.classId, 128);
      const actionDate = textValue(body?.actionDate, 10);
      const aiContext = await resolveAIContext(supabase, user, {
        organizationId,
        classId: classId || undefined,
        actionDate: actionDate || undefined,
        navigation: {
          screen: classId ? "class_detail" : "planning",
          entityType: classId ? "class" : undefined,
          entityId: classId || undefined,
        },
      });
      const facts = await resolveAIMemory(supabase, aiContext);
      const periodization = await resolveAIPeriodizationContext(
        supabase,
        aiContext.action.classId ?? "",
        aiContext.action.date
      );
      const resolved = await resolveAIDocumentContext(
        supabase,
        aiContext,
        facts,
        {
          queryText,
          sportHint: textValue(body?.sportHint, 80) || "volleyball",
          maxDocuments: clampMaxDocuments(body?.maxDocuments),
          periodization,
        }
      );

      return createSuccess({
        status: "ready",
        actionDate: resolved.actionDate,
        documents: resolved.documents.map(publicDocumentPayload),
        retrieval: {
          cacheHit: resolved.cacheHit,
          latencyMs: resolved.retrievalLatencyMs,
        },
        actionContract: {
          mode: "read_only",
          allowedActions: ["answer", "explain", "compare", "propose"],
          forbiddenActions: [
            "apply",
            "persist",
            "mutate_plan",
            "regenerate_pdf",
            "create_global_memory",
          ],
          requiresExplicitConfirmation: true,
          canWrite: false,
        },
      });
    },
  })
);
