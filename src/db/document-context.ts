import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import { getValidAccessToken } from "../auth/session";
import type {
  AppliedPedagogicalReference,
  PedagogicalReferenceDocumentType,
  PedagogicalReferenceEvidenceLevel,
  PedagogicalReferenceMaterialType,
  PedagogicalReferenceSourceScope,
} from "../core/document-intelligence";

export type DocumentContextLayer =
  | "safety_law"
  | "confirmed_plan"
  | "realized_history"
  | "institutional"
  | "periodization"
  | "academic"
  | "scientific"
  | "general";

export type DocumentPlanningReference = AppliedPedagogicalReference & {
  documentType?: string;
  sourceDate?: string;
  confidence?: number;
  period?: string;
  isPrimaryPlanningSource?: boolean;
  sourceKind?: string;
};

export type DocumentPlanningSupport = {
  status: "available" | "no_relevant_content" | "unavailable";
  references: DocumentPlanningReference[];
  warnings: string[];
  retrievalMode?: "contextual";
  actionDate?: string;
  actionContract: {
    mode: "read_only";
    allowedActions: readonly ["answer", "explain", "compare", "propose"];
    forbiddenActions: readonly [
      "apply",
      "persist",
      "mutate_plan",
      "regenerate_pdf",
      "create_global_memory",
    ];
    requiresExplicitConfirmation: true;
    canWrite: false;
  };
};

export type DocumentPlanningRetrievalContext = {
  modality?: string;
  ageBand?: string;
  objective?: string;
  skill?: string;
  pedagogicalApproach?: string;
  situationProblem?: string;
  classNeeds?: string[];
  sessionDate: string;
};

const FUNCTIONS_BASE = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;
const DOCUMENT_CONTEXT_TIMEOUT_MS = 5_000;

const READ_ONLY_ACTION_CONTRACT = {
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
} as const;

const textValue = (value: unknown, max = 900) =>
  String(value ?? "").trim().slice(0, max);

const safeRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const stringArray = (value: unknown, max = 12) =>
  Array.isArray(value)
    ? value
        .map((item) => textValue(item, 180))
        .filter(Boolean)
        .slice(0, max)
    : [];

const uniqueStrings = (values: (string | null | undefined)[]) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const allowedSourceScopes = new Set<PedagogicalReferenceSourceScope>([
  "user_academic",
  "system_academic",
  "workspace_academic",
  "institutional",
  "class_planning",
  "realized_history",
  "periodization",
  "scientific",
  "system_general",
]);

const materialTypes = new Set<PedagogicalReferenceMaterialType>([
  "official_norm",
  "scientific_article",
  "book_or_chapter",
  "university_handout",
  "lecture_presentation",
  "student_summary",
  "personal_note",
  "monthly_plan",
  "lesson_plan",
  "realized_report",
  "institutional_actions",
  "unknown",
]);

const evidenceLevels = new Set<PedagogicalReferenceEvidenceLevel>([
  "official_norm",
  "scientific_research",
  "published_book",
  "institutional_academic_material",
  "classroom_academic_material",
  "student_authored_summary",
  "personal_note",
  "confirmed_plan",
  "realized_report",
  "institutional_guidance",
  "contextual_support",
  "unknown_support",
]);

const sourceScopeForDocument = (
  value: unknown,
  layer: DocumentContextLayer
): PedagogicalReferenceSourceScope => {
  const raw = textValue(value, 80);
  const canonical =
    raw === "workspace_institutional"
      ? "institutional"
      : raw === "class_history"
        ? "realized_history"
        : raw === "scientific_reference"
          ? "scientific"
          : raw;
  if (allowedSourceScopes.has(canonical as PedagogicalReferenceSourceScope)) {
    return canonical as PedagogicalReferenceSourceScope;
  }
  if (layer === "confirmed_plan") return "class_planning";
  if (layer === "realized_history") return "realized_history";
  if (layer === "periodization") return "periodization";
  if (layer === "institutional" || layer === "safety_law") return "institutional";
  if (layer === "scientific") return "scientific";
  if (layer === "academic") return "workspace_academic";
  return "system_general";
};

const materialTypeForDocument = (
  row: Record<string, unknown>,
  layer: DocumentContextLayer
): PedagogicalReferenceMaterialType => {
  const documentType = documentTypeForRow(row, layer);
  if (
    documentType === "monthly_plan" ||
    documentType === "lesson_plan" ||
    documentType === "realized_report" ||
    documentType === "institutional_actions"
  ) {
    return documentType;
  }
  const materialType = textValue(row.materialType, 80);
  if (materialTypes.has(materialType as PedagogicalReferenceMaterialType)) {
    return materialType as PedagogicalReferenceMaterialType;
  }
  if (layer === "safety_law") return "official_norm";
  if (layer === "scientific") return "scientific_article";
  if (layer === "academic") return "university_handout";
  if (layer === "confirmed_plan") return "monthly_plan";
  if (layer === "realized_history") return "realized_report";
  if (layer === "institutional") return "institutional_actions";
  return "unknown";
};

const evidenceLevelForDocument = (
  row: Record<string, unknown>,
  layer: DocumentContextLayer
): PedagogicalReferenceEvidenceLevel => {
  const documentType = documentTypeForRow(row, layer);
  if (layer === "confirmed_plan") return "confirmed_plan";
  if (documentType === "realized_report") return "realized_report";
  if (documentType === "institutional_actions") {
    return "institutional_guidance";
  }
  if (documentType === "monthly_plan" || documentType === "lesson_plan") {
    return "contextual_support";
  }
  const evidenceKind = textValue(row.evidenceKind, 80);
  if (evidenceLevels.has(evidenceKind as PedagogicalReferenceEvidenceLevel)) {
    return evidenceKind as PedagogicalReferenceEvidenceLevel;
  }
  if (layer === "safety_law") return "official_norm";
  if (layer === "scientific") return "scientific_research";
  if (layer === "academic") return "institutional_academic_material";
  if (layer === "realized_history") return "realized_report";
  if (layer === "institutional") return "institutional_guidance";
  if (layer === "periodization") return "contextual_support";
  return "contextual_support";
};

const documentTypeForRow = (
  row: Record<string, unknown>,
  layer: DocumentContextLayer
): PedagogicalReferenceDocumentType => {
  const metadata = safeRecord(row.metadata);
  const candidate = textValue(
    metadata.document_class ??
      metadata.documentClass ??
      metadata.folder_role ??
      metadata.folderRole ??
      metadata.source_profile ??
      metadata.sourceProfile,
    80
  );
  const normalized =
    candidate === "report"
      ? "realized_report"
      : candidate === "institutional_guidance"
        ? "institutional_actions"
        : candidate === "academic"
          ? "academic_reference"
          : candidate;
  const allowed = new Set<PedagogicalReferenceDocumentType>([
    "monthly_plan",
    "lesson_plan",
    "realized_report",
    "institutional_actions",
    "academic_reference",
    "scientific_reference",
    "regulation",
    "unknown",
  ]);
  if (allowed.has(normalized as PedagogicalReferenceDocumentType)) {
    return normalized as PedagogicalReferenceDocumentType;
  }
  return layer === "confirmed_plan"
    ? "monthly_plan"
    : layer === "realized_history"
      ? "realized_report"
      : layer === "institutional"
        ? "institutional_actions"
        : layer === "academic"
          ? "academic_reference"
          : layer === "scientific"
            ? "scientific_reference"
            : layer === "safety_law"
              ? "regulation"
              : "unknown";
};

const influenceForLayer = (
  layer: DocumentContextLayer,
  documentType: string
) => {
  if (layer === "confirmed_plan") {
    return documentType === "lesson_plan"
      ? "Apoiou a sequência prevista para esta aula sem substituir decisões já confirmadas."
      : "Definiu o foco e a progressão previstos para o período desta turma.";
  }
  if (layer === "realized_history") {
    return "Registrou o que ocorreu antes desta aula e condicionou a progressão proposta.";
  }
  if (layer === "institutional" || layer === "safety_law") {
    return "Aplicou uma orientação institucional relevante ao contexto da turma.";
  }
  if (layer === "periodization") {
    return "Apoiou o foco do ciclo, da semana e da sessão planejada.";
  }
  if (layer === "academic" || layer === "scientific") {
    return "Apoiou a organização pedagógica, as adaptações e os critérios observáveis da aula.";
  }
  return "Complementou o contexto usado para preparar o plano.";
};

const sourceOriginLabel = (row: Record<string, unknown>) => {
  const metadata = safeRecord(row.metadata);
  const rawSource = textValue(row.source, 260);
  return (
    uniqueStrings([
      textValue(metadata.source_label ?? metadata.sourceLabel, 180),
      textValue(row.institution, 180),
      textValue(row.author, 180),
      /^https?:\/\//i.test(rawSource) ? "Google Drive" : rawSource,
    ])[0] || "Contexto documental"
  );
};

const normalizeSportHint = (value: unknown) => {
  const text = textValue(value, 80)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /volei|voleibol|volleyball/.test(text) ? "volleyball" : text || "volleyball";
};

const normalizeReference = (
  value: unknown
): DocumentPlanningReference | null => {
  const row = safeRecord(value);
  const layerValue = textValue(row.layer, 40);
  const layer = (
    [
      "safety_law",
      "confirmed_plan",
      "realized_history",
      "institutional",
      "periodization",
      "academic",
      "scientific",
      "general",
    ] as const
  ).includes(layerValue as DocumentContextLayer)
    ? (layerValue as DocumentContextLayer)
    : "general";
  const sourceDocumentId =
    textValue(row.sourceDocumentId, 180) || textValue(row.id, 180);
  const title = textValue(row.title, 260);
  const excerpt = textValue(row.sourceExcerpt || row.chunk, 900);
  if (!sourceDocumentId || !title || !excerpt) return null;

  const metadata = safeRecord(row.metadata);
  const documentType = documentTypeForRow(row, layer);
  const sourceDate =
    textValue(row.effectiveDate, 10) ||
    textValue(
      metadata.document_date ??
        metadata.documentDate ??
        metadata.report_date ??
        metadata.reportDate,
      10
    );
  const period =
    textValue(metadata.month_key ?? metadata.monthKey, 20) ||
    textValue(row.academicPeriod, 40);
  const confidence = Number(row.confidence);

  return {
    id: textValue(row.id, 180) || sourceDocumentId,
    sourceDocumentId,
    sourceRevisionId: textValue(row.sourceRevisionId, 180) || undefined,
    contentHash: textValue(row.contentHash, 80) || undefined,
    sourceScope: sourceScopeForDocument(row.sourceScope, layer),
    title,
    origin: sourceOriginLabel(row),
    discipline: textValue(row.discipline, 180) || undefined,
    materialType: materialTypeForDocument(row, layer),
    evidenceLevel: evidenceLevelForDocument(row, layer),
    sourceLocation: textValue(row.sourceLocation, 260) || undefined,
    excerpt,
    influence: influenceForLayer(layer, documentType),
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
    documentType,
    sourceDate: sourceDate || undefined,
    confidence:
      Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
        ? confidence
        : undefined,
    period: period || undefined,
    isPrimaryPlanningSource:
      sourceScopeForDocument(row.sourceScope, layer) === "class_planning" &&
      (documentType === "monthly_plan" || documentType === "lesson_plan"),
    sourceKind: layer,
  };
};

const dedupePlanningReferences = (
  references: DocumentPlanningReference[]
) => {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const identity =
      reference.publicIdentityId ||
      reference.sourceDocumentId ||
      reference.sourceRevisionId ||
      reference.contentHash ||
      reference.id;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

const unavailableSupport = (
  warning = "Contexto documental temporariamente indisponível; o plano seguirá com o contexto operacional já salvo."
): DocumentPlanningSupport => ({
  status: "unavailable",
  references: [],
  warnings: [warning],
  actionContract: READ_ONLY_ACTION_CONTRACT,
});

export async function retrieveDocumentPlanningSupport(params: {
  organizationId?: string | null;
  classId?: string | null;
  context: DocumentPlanningRetrievalContext;
  limit?: number;
}): Promise<DocumentPlanningSupport> {
  const organizationId = textValue(params.organizationId, 128);
  if (!organizationId) {
    return unavailableSupport("Workspace sem escopo documental válido.");
  }

  const queryText = uniqueStrings([
    params.context.modality,
    params.context.ageBand,
    params.context.objective,
    params.context.skill,
    params.context.pedagogicalApproach,
    params.context.situationProblem,
    ...stringArray(params.context.classNeeds),
  ])
    .join(" · ")
    .slice(0, 1_200);
  if (!queryText) {
    return {
      status: "no_relevant_content",
      references: [],
      warnings: [],
      actionDate: params.context.sessionDate,
      actionContract: READ_ONLY_ACTION_CONTRACT,
    };
  }

  try {
    const token = await getValidAccessToken();
    if (!token) {
      return unavailableSupport(
        "Sessão indisponível para consultar o contexto documental."
      );
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      DOCUMENT_CONTEXT_TIMEOUT_MS
    );
    let response: Response;
    try {
      response = await fetch(`${FUNCTIONS_BASE}/document-context-resolve`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          organizationId,
          classId: textValue(params.classId, 128) || undefined,
          actionDate: textValue(params.context.sessionDate, 10),
          queryText,
          sportHint: normalizeSportHint(params.context.modality),
          maxDocuments: Math.max(1, Math.min(params.limit ?? 8, 12)),
        }),
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) return unavailableSupport();

    const payload = safeRecord(await response.json());
    const references = Array.isArray(payload.documents)
      ? dedupePlanningReferences(
          payload.documents
            .map(normalizeReference)
            .filter(
              (
                reference
              ): reference is DocumentPlanningReference => Boolean(reference)
            )
        )
      : [];

    return {
      status: references.length ? "available" : "no_relevant_content",
      references,
      warnings: references.length
        ? []
        : ["Nenhum documento relevante e autorizado foi encontrado para esta aula."],
      retrievalMode: "contextual",
      actionDate:
        textValue(payload.actionDate, 10) || params.context.sessionDate,
      actionContract: READ_ONLY_ACTION_CONTRACT,
    };
  } catch {
    return unavailableSupport();
  }
}
