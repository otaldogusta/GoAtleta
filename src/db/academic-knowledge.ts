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
  status: "preview" | "in_progress" | "succeeded" | "partial" | "unavailable";
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
  authStrategy?: "api_key" | "oauth_user" | "service_account";
};

export type AcademicDriveOAuthStatus = {
  status: "connected" | "not_connected" | "unavailable";
  authorizationUrl?: string;
  googleAccountEmail?: string;
  authStrategy?: "api_key" | "oauth_user" | "service_account";
  warning?: string;
};

export const DEFAULT_PERSONAL_ACADEMIC_DRIVE_URL =
  "https://drive.google.com/drive/folders/1TtqVOgnLXeDqvGr6885s-KABA4tsJ5QE";

const FUNCTIONS_BASE = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;

const textValue = (value: unknown, max = 900) =>
  String(value ?? "")
    .trim()
    .slice(0, max);

const stringArray = (value: unknown, max = 12) =>
  Array.isArray(value)
    ? value
        .map((item) => textValue(item, 180))
        .filter(Boolean)
        .slice(0, max)
    : [];

const allowedSourceScopes = new Set<PedagogicalReferenceSourceScope>([
  "user_academic",
  "system_academic",
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
  value: unknown,
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
    sourceScopeText as PedagogicalReferenceSourceScope,
  )
    ? (sourceScopeText as PedagogicalReferenceSourceScope)
    : "user_academic";
  const materialType = academicMaterialTypes.has(
    materialTypeText as AcademicMaterialType,
  )
    ? (materialTypeText as AcademicMaterialType)
    : "unknown";
  const evidenceLevel = academicEvidenceLevels.has(
    evidenceLevelText as AcademicEvidenceLevel,
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
    publicIdentityId: textValue(row.publicIdentityId, 180) || undefined,
    citationLabel: textValue(row.citationLabel, 180) || undefined,
    authors: stringArray(row.authors),
    publicationYear: Number.isInteger(Number(row.publicationYear))
      ? Number(row.publicationYear)
      : undefined,
    publicationVenue: textValue(row.publicationVenue, 260) || undefined,
    doi: textValue(row.doi, 260) || undefined,
    officialUrl: textValue(row.officialUrl, 500) || undefined,
    studyDesign: textValue(row.studyDesign, 180) || undefined,
  };
};

const unavailableSupport = (
  warning = "Base acadêmica temporariamente indisponível; o plano seguirá com o contexto operacional.",
): AcademicPlanningSupport => ({
  status: "unavailable",
  references: [],
  warnings: [warning],
});

const authenticatedFunctionRequest = async (
  functionName: string,
  body: Record<string, unknown>,
) => {
  const token = await getValidAccessToken();
  if (!token) return null;
  return fetch(`${FUNCTIONS_BASE}/${functionName}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
};

export async function canManageGlobalAcademicKnowledge(): Promise<boolean> {
  try {
    const token = await getValidAccessToken();
    if (!token) return false;
    const response = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/has_global_capability`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_capability: "manage_global_academic_knowledge",
        }),
      },
    );
    return response.ok && (await response.json()) === true;
  } catch {
    return false;
  }
}

export async function getPersonalAcademicDriveOAuthStatus(params: {
  organizationId?: string | null;
  folderUrl?: string;
}): Promise<AcademicDriveOAuthStatus> {
  const organizationId = textValue(params.organizationId, 128);
  if (!organizationId) {
    return { status: "unavailable", warning: "Workspace inválido." };
  }
  try {
    const response = await authenticatedFunctionRequest(
      "document-drive-oauth",
      {
        action: "status",
        organizationId,
        folderUrl:
          textValue(params.folderUrl, 500) ||
          DEFAULT_PERSONAL_ACADEMIC_DRIVE_URL,
      },
    );
    if (!response?.ok) {
      return {
        status: "unavailable",
        warning: "Não foi possível consultar a conexão com o Drive.",
      };
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const connection =
      payload.connection &&
      typeof payload.connection === "object" &&
      !Array.isArray(payload.connection)
        ? (payload.connection as Record<string, unknown>)
        : {};
    const strategy = textValue(connection.authStrategy, 40);
    return {
      status: payload.status === "connected" ? "connected" : "not_connected",
      googleAccountEmail:
        textValue(connection.googleAccountEmail, 180) || undefined,
      authStrategy:
        strategy === "api_key" ||
        strategy === "oauth_user" ||
        strategy === "service_account"
          ? strategy
          : undefined,
    };
  } catch {
    return {
      status: "unavailable",
      warning: "Não foi possível consultar a conexão com o Drive.",
    };
  }
}

export async function startPersonalAcademicDriveOAuth(params: {
  organizationId?: string | null;
  folderUrl?: string;
  redirectTo: string;
}): Promise<AcademicDriveOAuthStatus> {
  const organizationId = textValue(params.organizationId, 128);
  if (!organizationId) {
    return { status: "unavailable", warning: "Workspace inválido." };
  }
  try {
    const response = await authenticatedFunctionRequest(
      "document-drive-oauth",
      {
        action: "start",
        organizationId,
        folderUrl:
          textValue(params.folderUrl, 500) ||
          DEFAULT_PERSONAL_ACADEMIC_DRIVE_URL,
        redirectTo: textValue(params.redirectTo, 500),
      },
    );
    if (!response?.ok) {
      return {
        status: "unavailable",
        warning: "Não foi possível iniciar a autorização do Google Drive.",
      };
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const authorizationUrl = textValue(payload.authorizationUrl, 1_500);
    return authorizationUrl
      ? { status: "not_connected", authorizationUrl }
      : {
          status: "unavailable",
          warning: "A autorização não retornou uma URL válida.",
        };
  } catch {
    return {
      status: "unavailable",
      warning: "Não foi possível iniciar a autorização do Google Drive.",
    };
  }
}

export async function disconnectPersonalAcademicDrive(params: {
  organizationId?: string | null;
  folderUrl?: string;
}): Promise<AcademicDriveOAuthStatus> {
  const organizationId = textValue(params.organizationId, 128);
  if (!organizationId) {
    return { status: "unavailable", warning: "Workspace inválido." };
  }
  try {
    const response = await authenticatedFunctionRequest(
      "document-drive-oauth",
      {
        action: "disconnect",
        organizationId,
        folderUrl:
          textValue(params.folderUrl, 500) ||
          DEFAULT_PERSONAL_ACADEMIC_DRIVE_URL,
      },
    );
    if (!response?.ok) {
      return {
        status: "unavailable",
        warning: "Não foi possível desconectar o Google Drive.",
      };
    }
    return { status: "not_connected" };
  } catch {
    return {
      status: "unavailable",
      warning: "Não foi possível desconectar o Google Drive.",
    };
  }
}

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

  const maxFiles = Math.max(1, Math.min(params.maxFiles ?? 60, 120));
  const emptySummary = () => ({
    discovered: 0,
    ready: 0,
    reviewRequired: 0,
    failed: 0,
    unchanged: 0,
    chunks: 0,
    promptInjectionWarnings: 0,
  });
  const summary = emptySummary();
  const numberValue = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  };
  const recoverInterruptedSync = async () => {
    try {
      await authenticatedFunctionRequest("academic-drive-sync", {
        action: "recover",
        organizationId,
        folderUrl:
          textValue(params.folderUrl, 500) ||
          DEFAULT_PERSONAL_ACADEMIC_DRIVE_URL,
      });
    } catch {
      // A próxima sincronização também substitui com segurança um estado antigo.
    }
  };

  try {
    let cursor = 0;
    for (let batchIndex = 0; batchIndex <= maxFiles; batchIndex += 1) {
      const response = await authenticatedFunctionRequest(
        "academic-drive-sync",
        {
          action: "sync",
          continuationMode: "server",
          organizationId,
          folderUrl:
            textValue(params.folderUrl, 500) ||
            DEFAULT_PERSONAL_ACADEMIC_DRIVE_URL,
          maxFiles,
          batchSize: 4,
          cursor,
          priorFailed: summary.failed,
          priorReviewRequired: summary.reviewRequired,
          dryRun: params.dryRun === true,
        },
      );
      if (!response) {
        await recoverInterruptedSync();
        return {
          status: "unavailable",
          sourceScope: "user_academic",
          classBindingCreated: false,
          warnings: ["Sessão indisponível para sincronizar a base acadêmica."],
        };
      }
      if (!response.ok) {
        const errorPayload = (await response
          .json()
          .catch(() => ({}))) as Record<string, unknown>;
        const errorCode = textValue(errorPayload.code, 80);
        await recoverInterruptedSync();
        return {
          status: "unavailable",
          sourceScope: "user_academic",
          classBindingCreated: false,
          warnings: [
            errorCode === "DRIVE_OAUTH_REQUIRED" ||
            errorCode === "DRIVE_AUTHORIZATION_FAILED"
              ? "Conecte uma conta Google autorizada para acessar esta pasta."
              : "Não foi possível sincronizar a base acadêmica agora.",
          ],
        };
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const payloadStatus = textValue(payload.status, 40);
      const rawSummary =
        payload.summary && typeof payload.summary === "object"
          ? (payload.summary as Record<string, unknown>)
          : null;
      if (rawSummary) {
        summary.discovered = Math.max(
          summary.discovered,
          numberValue(rawSummary.discovered),
        );
        summary.ready += numberValue(rawSummary.ready);
        summary.reviewRequired += numberValue(rawSummary.reviewRequired);
        summary.failed += numberValue(rawSummary.failed);
        summary.unchanged += numberValue(rawSummary.unchanged);
        summary.chunks += numberValue(rawSummary.chunks);
        summary.promptInjectionWarnings += numberValue(
          rawSummary.promptInjectionWarnings,
        );
      }

      if (payloadStatus === "in_progress") {
        return {
          status: "in_progress",
          folderId: textValue(payload.folderId, 180) || undefined,
          sourceScope: "user_academic",
          classBindingCreated: false,
          authStrategy:
            payload.authStrategy === "oauth_user" ||
            payload.authStrategy === "service_account" ||
            payload.authStrategy === "api_key"
              ? payload.authStrategy
              : undefined,
          summary,
          warnings: [],
        };
      }

      const status =
        payloadStatus === "preview" ||
        payloadStatus === "succeeded" ||
        payloadStatus === "partial"
          ? payloadStatus
          : "unavailable";
      return {
        status,
        folderId: textValue(payload.folderId, 180) || undefined,
        sourceScope: "user_academic",
        classBindingCreated: false,
        authStrategy:
          payload.authStrategy === "oauth_user" ||
          payload.authStrategy === "service_account" ||
          payload.authStrategy === "api_key"
            ? payload.authStrategy
            : undefined,
        summary: rawSummary ? summary : undefined,
        warnings:
          status === "partial"
            ? ["A sincronização terminou com arquivos que exigem revisão."]
            : status === "unavailable"
              ? ["A sincronização não retornou um estado válido."]
              : [],
      };
    }

    return {
      status: "unavailable",
      sourceScope: "user_academic",
      classBindingCreated: false,
      summary,
      warnings: ["A sincronização não conseguiu concluir todos os lotes."],
    };
  } catch {
    await recoverInterruptedSync();
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
  if (!organizationId)
    return unavailableSupport("Workspace sem escopo acadêmico válido.");

  try {
    const token = await getValidAccessToken();
    if (!token)
      return unavailableSupport(
        "Sessão indisponível para consultar a base acadêmica.",
      );

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
          classNeed:
            stringArray(params.context.classNeeds).join(" · ") || undefined,
          documentTypes: params.context.documentTypes ?? [],
          evidenceKinds: params.context.evidenceLevels ?? [],
          academicAreas: params.context.academicAreas ?? [],
          limit: Math.max(1, Math.min(params.limit ?? 4, 6)),
        }),
      },
    );
    if (!response.ok) return unavailableSupport();

    const payload = (await response.json()) as Record<string, unknown>;
    if (payload.status === "unavailable") return unavailableSupport();
    const references = Array.isArray(payload.references)
      ? payload.references
          .map(normalizeReference)
          .filter((reference): reference is AppliedPedagogicalReference =>
            Boolean(reference),
          )
      : [];
    if (!references.length) {
      return {
        status: "no_relevant_content",
        references: [],
        warnings: [
          "Nenhum trecho acadêmico relevante foi encontrado para esta aula.",
        ],
        retrievalMode: (
          payload.retrieval as
            { mode?: "semantic" | "lexical_fallback" } | undefined
        )?.mode,
      };
    }

    return {
      status: "available",
      references,
      warnings: [],
      retrievalMode: (
        payload.retrieval as
          { mode?: "semantic" | "lexical_fallback" } | undefined
      )?.mode,
    };
  } catch {
    return unavailableSupport();
  }
}
