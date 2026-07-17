export type DocumentSourceProvider =
  | "google_drive"
  | "upload"
  | "url"
  | "pasted_text";

export type DocumentSourceRecord = {
  id: string;
  organizationId: string;
  programId?: string;
  modalityId?: string;
  classId?: string;
  provider: DocumentSourceProvider;
  externalId?: string;
  externalRevisionId?: string;
  sourceUrl?: string;
  filename: string;
  mimeType: string;
  contentHash: string;
  modifiedAt?: string;
};
export type DocumentContextInput = Pick<
  DocumentSourceRecord,
  "organizationId" | "programId" | "modalityId" | "classId"
>;

export type DocumentIngestionInput = DocumentContextInput & {
  id: string;
  provider: DocumentSourceProvider;
  content: string;
  filename: string;
  mimeType: string;
  externalId?: string;
  externalRevisionId?: string;
  sourceUrl?: string;
  modifiedAt?: string;
};

export type DocumentSyncStatus = "created" | "unchanged" | "updated";

export type DocumentIngestionResult = {
  source: DocumentSourceRecord;
  normalizedContent: string;
  syncStatus: DocumentSyncStatus;
};

export type AcademicDiscipline =
  | "gestao_trabalho_pedagogico"
  | "pratica_ensino_educacao_infantil"
  | "curriculo_fundamentos_cultura"
  | "educacao_basica_politica_legislacao"
  | "libras"
  | "tendencias_pedagogicas_didatica"
  | "unknown";

export type AcademicArea =
  | "didatica"
  | "curriculo"
  | "politicas_educacionais"
  | "planejamento_pedagogico"
  | "avaliacao"
  | "desenvolvimento_infantil"
  | "inclusao"
  | "acessibilidade"
  | "libras"
  | "metodologias_ensino"
  | "abordagens_pedagogicas"
  | "gestao_educacional"
  | "legislacao"
  | "etica"
  | "conhecimento_cientifico_tecnico"
  | "nao_classificado";

export type AcademicMaterialType =
  | "official_norm"
  | "scientific_article"
  | "book_or_chapter"
  | "university_handout"
  | "lecture_presentation"
  | "student_summary"
  | "personal_note"
  | "unknown";

export type AcademicEvidenceLevel =
  | "official_norm"
  | "scientific_research"
  | "published_book"
  | "institutional_academic_material"
  | "classroom_academic_material"
  | "student_authored_summary"
  | "personal_note"
  | "unknown_support";

export type AcademicKnowledgeLayer = "academic" | "institutional" | "unknown";

export type AcademicSourceScope =
  | {
      kind: "user_academic";
      userId: string;
      organizationId?: never;
      classId?: never;
    }
  | {
      kind: "workspace_academic";
      organizationId: string;
      userId?: string;
      classId?: never;
    };

export type PedagogicalReferenceSourceScope =
  | AcademicSourceScope["kind"]
  | "institutional"
  | "class_planning"
  | "realized_history"
  | "periodization"
  | "scientific"
  | "system_general";

export type PedagogicalReferenceMaterialType =
  | AcademicMaterialType
  | "monthly_plan"
  | "lesson_plan"
  | "realized_report"
  | "institutional_actions";

export type PedagogicalReferenceEvidenceLevel =
  | AcademicEvidenceLevel
  | "confirmed_plan"
  | "realized_report"
  | "institutional_guidance"
  | "contextual_support";

export type PedagogicalReferenceDocumentType =
  | "monthly_plan"
  | "lesson_plan"
  | "realized_report"
  | "institutional_actions"
  | "academic_reference"
  | "scientific_reference"
  | "regulation"
  | "unknown";

export type AppliedPedagogicalReference = {
  id: string;
  sourceDocumentId: string;
  sourceRevisionId?: string;
  contentHash?: string;
  sourceScope: PedagogicalReferenceSourceScope;
  title: string;
  origin: string;
  discipline?: string;
  materialType: PedagogicalReferenceMaterialType;
  evidenceLevel: PedagogicalReferenceEvidenceLevel;
  documentType?: PedagogicalReferenceDocumentType;
  sourceDate?: string;
  confidence?: number;
  period?: string;
  isPrimaryPlanningSource?: boolean;
  sourceKind?: string;
  sourceLocation?: string;
  excerpt: string;
  influence: string;
  appliedAt?: string;
};

export type AcademicDocumentClassificationInput = {
  filename: string;
  title?: string;
  content: string;
  author?: string;
  institution?: string;
  sourceUrl?: string;
};

export type AcademicDocumentClassification = {
  discipline: AcademicDiscipline;
  areas: AcademicArea[];
  materialType: AcademicMaterialType;
  evidenceLevel: AcademicEvidenceLevel;
  knowledgeLayer: AcademicKnowledgeLayer;
  confidence: number;
  warnings: string[];
};

export type AcademicContentSanitizationResult = {
  sanitizedContent: string;
  blockedInstructions: string[];
};

export type AcademicChunkProvenance = {
  sourceDocumentId: string;
  sourceRevisionId?: string;
  contentHash?: string;
  folderId?: string;
  filename: string;
  title: string;
  author?: string;
  institution?: string;
  sourceUrl?: string;
  sourceScope: AcademicSourceScope;
  discipline: AcademicDiscipline;
  materialType: AcademicMaterialType;
  evidenceLevel: AcademicEvidenceLevel;
  sourceLocation: string;
};

export type AcademicKnowledgeChunk = {
  id: string;
  text: string;
  areas: AcademicArea[];
  keywords: string[];
  provenance: AcademicChunkProvenance;
};

export type AcademicChunkingInput = {
  sourceDocumentId: string;
  sourceRevisionId?: string;
  contentHash?: string;
  folderId?: string;
  filename: string;
  title?: string;
  author?: string;
  institution?: string;
  sourceUrl?: string;
  sourceScope: AcademicSourceScope;
  content: string;
  maxChunkChars?: number;
};

export type AcademicRetrievalContext = {
  modality?: string;
  ageBand?: string;
  objective?: string;
  skill?: string;
  pedagogicalApproach?: string;
  situationProblem?: string;
  classNeeds?: string[];
  requestedAreas?: AcademicArea[];
  allowedEvidenceLevels?: AcademicEvidenceLevel[];
};

export type AcademicRetrievedChunk = {
  chunk: AcademicKnowledgeChunk;
  score: number;
  matchedTerms: string[];
  matchedAreas: AcademicArea[];
};

export type AcademicPlanSnapshot = {
  id: string;
  confirmed: boolean;
  fields: Record<string, unknown>;
};

export type AcademicReportEvidence = {
  date: string;
  readiness: "mastered" | "not_mastered" | "unknown";
  evidence: string;
};

export type AcademicRecommendationDirection =
  | "advance"
  | "maintain"
  | "regress"
  | "adapt";

export type AcademicPlanningRecommendation = {
  id: string;
  targetField: string;
  proposedValue: unknown;
  reason: string;
  direction: AcademicRecommendationDirection;
  sourceChunkIds: string[];
  confidence: number;
};

export type AcademicReconciledRecommendation = AcademicPlanningRecommendation & {
  recommendation: "review" | "keep_current" | "ignore";
  reconciliationReason: string;
};

export type AcademicReconciliationResult = {
  currentPlan: AcademicPlanSnapshot;
  recommendations: AcademicReconciledRecommendation[];
  warnings: string[];
};

export type AcademicTeacherMemoryProposal = {
  id: string;
  userId: string;
  preference: string;
  evidenceChunkIds: string[];
  confidence: number;
  status: "pending_confirmation" | "confirmed" | "rejected";
};

export type ConfirmedAcademicTeacherFact = {
  id: string;
  userId: string;
  memoryScope: "user_global";
  factType: "coach_preference";
  content: { preference: string };
  evidenceChunkIds: string[];
  confidence: number;
  confirmedBy: string;
  confirmedAt: string;
};

export type AcademicReferencePresentation = {
  id: string;
  title: string;
  origin: string;
  discipline?: string;
  materialType: PedagogicalReferenceMaterialType;
  evidenceLevel: PedagogicalReferenceEvidenceLevel;
  sourceLocation?: string;
  excerpt: string;
  influence: string;
};

export type AcademicSupportResolution =
  | {
      status: "available";
      retrieved: AcademicRetrievedChunk[];
      warnings: string[];
      canContinueWithoutAcademicSupport: true;
    }
  | {
      status: "no_relevant_content" | "unavailable";
      retrieved: [];
      warnings: string[];
      canContinueWithoutAcademicSupport: true;
    };

export type ExtractedDocumentField<T> = {
  value: T | null;
  confidence: number;
  sourceText?: string;
  sourceLocation?: string;
  warnings: string[];
};

export type DocumentInterpretationType =
  | "monthly_plan"
  | "lesson_plan"
  | "report"
  | "calendar"
  | "assessment"
  | "institutional_guidance"
  | "regulation"
  | "academic_reference"
  | "unknown";

export type DocumentInterpretation = {
  sourceDocumentId: string;
  documentType: DocumentInterpretationType;
  fields: Record<string, ExtractedDocumentField<unknown>>;
  warnings: string[];
  extractionConfidence: number;
};

export type DocumentContextBinding = {
  organizationId: string;
  programId?: string;
  modalityId?: string;
  classId?: string;
  period?: string;
  confidence: number;
  status: "confirmed" | "ambiguous" | "unresolved";
};

export type AppStateSnapshot = {
  id: string;
  organizationId: string;
  classId: string;
  capturedAt: string;
  version: string;
  state: unknown;
};

export type ReconciliationKind =
  | "new_information"
  | "complement"
  | "conflict"
  | "stale_information"
  | "duplicate"
  | "missing_in_document"
  | "missing_in_app";

export type DocumentEvidenceSourceKind =
  | "safety_or_legal"
  | "workspace_rule"
  | "confirmed_teacher_decision"
  | "confirmed_plan"
  | "realized_history"
  | "institutional_guidance"
  | "periodization"
  | "academic_reference"
  | "general_system";

export type DocumentReconciliationTargetType =
  | "cycle"
  | "session"
  | "report"
  | "class"
  | "event"
  | "deadline";

export type DocumentReconciliationSource = {
  interpretation: DocumentInterpretation;
  binding: DocumentContextBinding;
  sourceKind: DocumentEvidenceSourceKind;
  targetType?: DocumentReconciliationTargetType;
  targetId?: string;
  realizedAt?: string;
  sourceModifiedAt?: string;
};

export type DocumentEligibleEvidence = {
  id: string;
  sourceDocumentId: string;
  sourceKind: DocumentEvidenceSourceKind;
  sourcePrecedence: number;
  targetType: DocumentReconciliationTargetType;
  targetId?: string;
  fieldKey: string;
  value: unknown;
  sourceText?: string;
  sourceLocation?: string;
  realizedAt?: string;
  sourceModifiedAt?: string;
  extractionConfidence: number;
  bindingConfidence: number;
  fieldConfidence: number;
  effectiveConfidence: number;
  warnings: string[];
};

export type DocumentRejectedEvidenceReason =
  | "scope_mismatch"
  | "binding_not_confirmed"
  | "low_confidence"
  | "missing_realized_date"
  | "invalid_realized_date"
  | "not_before_session"
  | "empty_interpretation";

export type DocumentRejectedEvidence = {
  sourceDocumentId: string;
  fieldKey?: string;
  reasonCode: DocumentRejectedEvidenceReason;
  reason: string;
  confidence?: number;
};

export type DocumentProposalDecision = {
  targetField: string;
  proposedValue: unknown;
  decision: "approved" | "adjusted" | "rejected";
  decidedAt: string;
  decidedBy?: string;
  reason?: string;
};

export type DocumentMergeItem = {
  id: string;
  kind: ReconciliationKind;
  targetType: DocumentReconciliationTargetType;
  targetId?: string;
  targetField: string;
  currentValue: unknown;
  proposedValue: unknown;
  recommendation: "apply" | "review" | "keep_current" | "ignore";
  reason: string;
  recommendationConfidence: number;
  sourceDocumentId: string;
  sourceKind: DocumentEvidenceSourceKind;
  sourceLocation?: string;
  sourceText?: string;
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
};

export type DocumentPlanningContext = {
  organizationId: string;
  classId: string;
  sessionStartsAt: string;
  snapshotId: string;
  snapshotVersion: string;
  sourcePrecedence: DocumentEvidenceSourceKind[];
  eligibleEvidence: DocumentEligibleEvidence[];
  rejectedEvidence: DocumentRejectedEvidence[];
  warnings: string[];
};

export type DocumentReconciliationResult = {
  sourceDocumentId: string;
  snapshotId: string;
  items: DocumentMergeItem[];
  rejectedEvidence: DocumentRejectedEvidence[];
  warnings: string[];
};

export type DocumentMergeProposal = {
  id: string;
  sourceDocumentId: string;
  organizationId: string;
  classId: string;
  snapshotVersion: string;
  items: DocumentMergeItem[];
  status: "draft" | "approved" | "partially_approved" | "rejected" | "applied";
};

export type DocumentReadOnlyAction =
  | "answer"
  | "explain"
  | "compare"
  | "propose";

export type DocumentForbiddenWriteAction =
  | "apply"
  | "persist"
  | "mutate_plan"
  | "regenerate_pdf"
  | "create_global_memory";

export type DocumentReadOnlyActionContract = {
  mode: "read_only";
  allowedActions: readonly DocumentReadOnlyAction[];
  forbiddenActions: readonly DocumentForbiddenWriteAction[];
  requiresExplicitConfirmation: true;
  canWrite: false;
};

export type DocumentReconciliationBundle = {
  context: DocumentPlanningContext;
  result: DocumentReconciliationResult;
  proposal: DocumentMergeProposal;
  actionContract: DocumentReadOnlyActionContract;
};
