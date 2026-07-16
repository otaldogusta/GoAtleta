import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import { getValidAccessToken } from "../auth/session";
import type {
  AcademicArea,
  AcademicEvidenceLevel,
  AcademicMaterialType,
  AppliedPedagogicalReference,
  PedagogicalReferenceSourceScope,
} from "../core/document-intelligence";

export type AcademicPlanningRetrievalContext = {
  modality?: string;
  ageBand?: string;
  objective?: string;
  skill?: string;
  pedagogicalApproach?: string;
  situationProblem?: string;
  classNeeds?: string[];
  documentTypes?: AcademicMaterialType[];
  evidenceLevels?: AcademicEvidenceLevel[];
  academicAreas?: AcademicArea[];
};

export type AcademicPlanningSupport = {
  status: "available" | "no_relevant_content" | "unavailable";
  references: AppliedPedagogicalReference[];
  warnings: string[];
  retrievalMode?: "semantic" | "lexical_fallback";
};

export type AcademicDriveSyncResult = {
  status: "preview" | "succeeded" | "partial" | "unavailable";
  folderId?: string;
  sourceScope: "user_academic";
  classBindingCreated: false;
  summary?: {
    discovered: number;
    ready: number;
    reviewRequired: number;
    failed: number;
    unchanged: number;
    chunks: number;
    promptInjectionWarnings: number;
  };
  warnings: string[];
};

export const DEFAULT_PERSONAL_ACADEMIC_DRIVE_URL =
  "https://drive.google.com/drive/folders/1TtqVOgnLXeDqvGr6885s-KABA4tsJ5QE";

const FUNCTIONS_BASE = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;

const textValue = (value: unknown, max = 900) =>
  String(value ?? "").trim().slice(0, max);

const stringArray = (value: unknown, max = 12) =>
  Array.isArray(value)
    ? value
        .map((item) => textValue(item, 180))
        .filter(Boolean)
        .slice(0, max)
    : [];

const allowedSourceScopes = new Set<PedagogicalReferenceSourceScope>([
  "user_academic",
  "workspace_academic",
  "institutional",
  "class_planning",
  "realized_history",
  "scientific",
  "system_general",
]);

const academicMaterialTypes = new Set<AcademicMaterialType>([
  "official_norm",
  "scientific_article",
  "book_or_chapter",
  "university_handout",
  "lecture_presentation",
  "student_summary",
  "personal_note",
  "unknown",
]);

const academicEvidenceLevels = new Set<AcademicEvidenceLevel>([
  "official_norm",
  "scientific_research",
  "published_book",
  "institutional_academic_material",
  "classroom_academic_material",
  "student_authored_summary",
  "personal_note",
  "unknown_support",
]);

const normalizeReference = (
  value: unknown
): AppliedPedagogicalReference | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = textValue(row.id, 180);
  const sourceDocumentId = textValue(row.sourceDocumentId, 180);
  const title = textValue(row.title, 260);
  const excerpt = textValue(row.excerpt, 900);
  const influence = textValue(row.influence, 500);
  if (!id || !sourceDocumentId || !title || !excerpt || !influence) return null;

  const sourceScopeText = textValue(row.sourceScope, 80);
  const materialTypeText = textValue(row.materialType, 80);
  const evidenceLevelText = textValue(row.evidenceLevel, 80);
  const sourceScope = allowedSourceScopes.has(
    sourceScopeText as PedagogicalReferenceSourceScope
  )
    ? (sourceScopeText as PedagogicalReferenceSourceScope)
    : "user_academic";
  const materialType = academicMaterialTypes.has(
    materialTypeText as AcademicMaterialType
  )
    ? (materialTypeText as AcademicMaterialType)
    : "unknown";
  const evidenceLevel = academicEvidenceLevels.has(
    evidenceLevelText as AcademicEvidenceLevel
  )
    ? (evidenceLevelText as AcademicEvidenceLevel)
    : "unknown_support";

  return {
    id,
    sourceDocumentId,
    sourceRevisionId: textValue(row.sourceRevisionId, 180) || undefined,
    contentHash: textValue(row.contentHash, 80) || undefined,
    sourceScope,
    title,
    origin: textValue(row.origin, 260) || "Base acadêmica pessoal",
    discipline: textValue(row.discipline, 180) || undefined,
    materialType,
    evidenceLevel,
    sourceLocation: textValue(row.sourceLocation, 260) || undefined,
    excerpt,
    influence,
  };
};

const unavailableSupport = (
  warning = "Base acadêmica temporariamente indisponível; o plano seguirá com o contexto operacional."
): AcademicPlanningSupport => ({
  status: "unavailable",
  references: [],
  warnings: [warning],
});

export async function syncPersonalAcademicDrive(params: {
  organizationId?: string | null;
  folderUrl?: string;
  maxFiles?: number;
  dryRun?: boolean;
}): Promise<AcademicDriveSyncResult> {
  const organizationId = textValue(params.organizationId, 128);
  if (!organizationId) {
    return {
      status: "unavailable",
      sourceScope: "user_academic",
      classBindingCreated: false,
      warnings: ["Workspace sem escopo acadêmico válido."],
    };
  }

  try {
    const token = await getValidAccessToken();
    if (!token) {
      return {
        status: "unavailable",
        sourceScope: "user_academic",
        classBindingCreated: false,
        warnings: ["Sessão indisponível para sincronizar a base acadêmica."],
      };
    }
    const response = await fetch(`${FUNCTIONS_BASE}/academic-drive-sync`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organizationId,
        folderUrl:
          textValue(params.folderUrl, 500) ||
          DEFAULT_PERSONAL_ACADEMIC_DRIVE_URL,
        maxFiles: Math.max(1, Math.min(params.maxFiles ?? 60, 120)),
        dryRun: params.dryRun === true,
      }),
    });
    if (!response.ok) {
      return {
        status: "unavailable",
        sourceScope: "user_academic",
        classBindingCreated: false,
        warnings: ["Não foi possível sincronizar a base acadêmica agora."],
      };
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const payloadStatus = textValue(payload.status, 40);
    const status =
      payloadStatus === "preview" ||
      payloadStatus === "succeeded" ||
      payloadStatus === "partial"
        ? payloadStatus
        : "unavailable";
    const rawSummary =
      payload.summary && typeof payload.summary === "object"
        ? (payload.summary as Record<string, unknown>)
        : null;
    const numberValue = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    };

    return {
      status,
      folderId: textValue(payload.folderId, 180) || undefined,
      sourceScope: "user_academic",
      classBindingCreated: false,
      summary: rawSummary
        ? {
            discovered: numberValue(rawSummary.discovered),
            ready: numberValue(rawSummary.ready),
            reviewRequired: numberValue(rawSummary.reviewRequired),
            failed: numberValue(rawSummary.failed),
            unchanged: numberValue(rawSummary.unchanged),
            chunks: numberValue(rawSummary.chunks),
            promptInjectionWarnings: numberValue(
              rawSummary.promptInjectionWarnings
            ),
          }
        : undefined,
      warnings:
        status === "partial"
          ? ["A sincronização terminou com arquivos que exigem revisão."]
          : status === "unavailable"
            ? ["A sincronização não retornou um estado válido."]
            : [],
    };
  } catch {
    return {
      status: "unavailable",
      sourceScope: "user_academic",
      classBindingCreated: false,
      warnings: ["Não foi possível sincronizar a base acadêmica agora."],
    };
  }
}

export async function retrieveAcademicPlanningSupport(params: {
  organizationId?: string | null;
  classId?: string | null;
  context: AcademicPlanningRetrievalContext;
  limit?: number;
}): Promise<AcademicPlanningSupport> {
  const organizationId = textValue(params.organizationId, 128);
  if (!organizationId) return unavailableSupport("Workspace sem escopo acadêmico válido.");

  try {
    const token = await getValidAccessToken();
    if (!token) return unavailableSupport("Sessão indisponível para consultar a base acadêmica.");

    const response = await fetch(
      `${FUNCTIONS_BASE}/academic-knowledge-retrieve`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId,
          classId: textValue(params.classId, 128) || undefined,
          modality: textValue(params.context.modality, 80) || undefined,
          ageBand: textValue(params.context.ageBand, 80) || undefined,
          objective: textValue(params.context.objective, 500) || undefined,
          skill: textValue(params.context.skill, 80) || undefined,
          pedagogicalApproach:
            textValue(params.context.pedagogicalApproach, 160) || undefined,
          situationProblem:
            textValue(params.context.situationProblem, 500) || undefined,
          classNeed: stringArray(params.context.classNeeds).join(" · ") || undefined,
          documentTypes: params.context.documentTypes ?? [],
          evidenceKinds: params.context.evidenceLevels ?? [],
          academicAreas: params.context.academicAreas ?? [],
          limit: Math.max(1, Math.min(params.limit ?? 4, 6)),
        }),
      }
    );
    if (!response.ok) return unavailableSupport();

    const payload = (await response.json()) as Record<string, unknown>;
    if (payload.status === "unavailable") return unavailableSupport();
    const references = Array.isArray(payload.references)
      ? payload.references
          .map(normalizeReference)
          .filter(
            (
              reference
            ): reference is AppliedPedagogicalReference => Boolean(reference)
          )
      : [];
    if (!references.length) {
      return {
        status: "no_relevant_content",
        references: [],
        warnings: ["Nenhum trecho acadêmico relevante foi encontrado para esta aula."],
        retrievalMode:
          (payload.retrieval as { mode?: "semantic" | "lexical_fallback" } | undefined)
            ?.mode,
      };
    }

    return {
      status: "available",
      references,
      warnings: [],
      retrievalMode:
        (payload.retrieval as { mode?: "semantic" | "lexical_fallback" } | undefined)
          ?.mode,
    };
  } catch {
    return unavailableSupport();
  }
}
