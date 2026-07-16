import type {
  CycleDayPlanningContext,
  AdaptiveLessonEnvelope,
  ClassReadinessState,
  PedagogicalFeedbackSignal,
  PedagogicalIntent,
  ProgressionDimension,
  SessionCoachGuidance,
  VolleyballSkill,
  WeeklyLoadIntent,
} from "./models";
import type {
  AppliedPedagogicalReference,
  DocumentReadOnlyActionContract,
} from "./document-intelligence/types";

export const SESSION_PLANNING_CONTEXT_SCHEMA_VERSION = 1 as const;

export type SessionPlanningContextSchemaVersion =
  typeof SESSION_PLANNING_CONTEXT_SCHEMA_VERSION;

export type SessionPlanningUpcomingEvent = {
  title: string;
  date: string;
  classScoped: boolean;
};

export type SessionPlanningClassProfile = {
  level: number;
  daysPerWeek: number;
  size: number;
  heterogeneity: string;
};

export type ReportFeedbackSignal = {
  participationLevel?: "low" | "normal";
  techniqueSignal?: "recurring_difficulty" | "stable";
  classClimate?: "agitated" | "conflict" | "stable";
  loadSignal?: "low_frequency" | "normal";
  notes: string[];
};

export type SessionPlanningDailyPlanAnchor = {
  schemaVersion: 1;
  dailyPlanId: string;
  weeklyPlanId: string;
  sessionDate: string;
  title: string;
  objectiveHint?: string;
  plannedBlocks: Array<{
    key: "warmup" | "main" | "cooldown";
    label: string;
    activities: string[];
  }>;
  observations?: string;
  syncStatus?: "in_sync" | "out_of_sync" | "overridden" | "stale_parent";
  skillHints: VolleyballSkill[];
  activityHints: string[];
  constraintHints: string[];
  conflictResolved: boolean;
  conflictReasons: string[];
};

export type SessionPlanningDocumentSupport = {
  status: "available" | "no_relevant_content" | "unavailable";
  references: AppliedPedagogicalReference[];
  warnings: string[];
  retrievalMode?: "semantic" | "lexical_fallback" | "contextual";
  actionDate?: string;
  actionContract?: DocumentReadOnlyActionContract;
};

export type SessionPlanningContext = {
  schemaVersion: SessionPlanningContextSchemaVersion;
  classId: string;
  sessionDate: string;
  ageBand: string;
  sport: "volleyball";
  skillFocus: VolleyballSkill;
  secondarySkill?: VolleyballSkill;
  cycleGoal?: string;
  weekGoal?: string;
  weekNumber?: number;
  sessionIndexInWeek?: number;
  periodizationPhase?: CycleDayPlanningContext["planningPhase"];
  progressionDimension: ProgressionDimension;
  pedagogicalIntent: PedagogicalIntent;
  loadIntent: WeeklyLoadIntent;
  previousSessionSummary?: string;
  recentDifficulties: string[];
  recentActivityFamilies: string[];
  recentActivityNames?: string[];
  recentActivityPatternIds?: string[];
  upcomingEvents: SessionPlanningUpcomingEvent[];
  availableDuration: number;
  materials: string[];
  classProfile: SessionPlanningClassProfile;
  constraints: string[];
  reportFeedback?: ReportFeedbackSignal;
  dailyPlanAnchor?: SessionPlanningDailyPlanAnchor;
  readinessState?: ClassReadinessState;
  adaptiveEnvelope?: AdaptiveLessonEnvelope;
  coachGuidance?: SessionCoachGuidance;
  documentSupport?: SessionPlanningDocumentSupport;
  /** Compatibilidade de leitura para snapshots criados antes da camada unificada. */
  academicSupport?: SessionPlanningDocumentSupport;
};

export type ParsedSessionPlanningContext =
  | {
      status: "current" | "legacy";
      context: SessionPlanningContext;
      warnings: string[];
    }
  | {
      status: "invalid";
      context: null;
      warnings: string[];
    };

const volleyballSkills: VolleyballSkill[] = [
  "passe",
  "levantamento",
  "ataque",
  "bloqueio",
  "defesa",
  "saque",
  "transicao",
];

const referenceSourceScopes = new Set<
  AppliedPedagogicalReference["sourceScope"]
>([
  "user_academic",
  "workspace_academic",
  "institutional",
  "class_planning",
  "realized_history",
  "periodization",
  "scientific",
  "system_general",
]);

const referenceMaterialTypes = new Set<
  AppliedPedagogicalReference["materialType"]
>([
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

const referenceEvidenceLevels = new Set<
  AppliedPedagogicalReference["evidenceLevel"]
>([
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

const referenceDocumentTypes = new Set<
  NonNullable<AppliedPedagogicalReference["documentType"]>
>([
  "monthly_plan",
  "lesson_plan",
  "realized_report",
  "institutional_actions",
  "academic_reference",
  "scientific_reference",
  "regulation",
  "unknown",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const numberValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => stringValue(item)).filter(Boolean)
    : [];

const isVolleyballSkill = (value: unknown): value is VolleyballSkill =>
  typeof value === "string" && volleyballSkills.includes(value as VolleyballSkill);

const parseDailyPlanAnchor = (value: unknown): SessionPlanningDailyPlanAnchor | undefined => {
  if (!isRecord(value)) return undefined;
  const dailyPlanId = stringValue(value.dailyPlanId);
  const weeklyPlanId = stringValue(value.weeklyPlanId);
  const sessionDate = stringValue(value.sessionDate);
  if (!dailyPlanId || !weeklyPlanId || !sessionDate) return undefined;

  const plannedBlocks = Array.isArray(value.plannedBlocks)
    ? value.plannedBlocks
        .filter(isRecord)
        .map((block) => {
          const key = stringValue(block.key);
          if (key !== "warmup" && key !== "main" && key !== "cooldown") return null;
          return {
            key,
            label: stringValue(block.label) || key,
            activities: stringArray(block.activities),
          };
        })
        .filter(
          (
            block
          ): block is {
            key: "warmup" | "main" | "cooldown";
            label: string;
            activities: string[];
          } => Boolean(block)
        )
    : [];

  const syncStatus = stringValue(value.syncStatus);

  return {
    schemaVersion: 1,
    dailyPlanId,
    weeklyPlanId,
    sessionDate,
    title: stringValue(value.title),
    objectiveHint: stringValue(value.objectiveHint) || undefined,
    plannedBlocks,
    observations: stringValue(value.observations) || undefined,
    syncStatus:
      syncStatus === "in_sync" ||
      syncStatus === "out_of_sync" ||
      syncStatus === "overridden" ||
      syncStatus === "stale_parent"
        ? syncStatus
        : undefined,
    skillHints: Array.isArray(value.skillHints)
      ? value.skillHints.filter(isVolleyballSkill)
      : [],
    activityHints: stringArray(value.activityHints),
    constraintHints: stringArray(value.constraintHints),
    conflictResolved: Boolean(value.conflictResolved),
    conflictReasons: stringArray(value.conflictReasons),
  };
};

const parseAppliedReference = (
  value: unknown
): AppliedPedagogicalReference | null => {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const sourceDocumentId = stringValue(value.sourceDocumentId);
  const title = stringValue(value.title);
  const excerpt = stringValue(value.excerpt);
  const influence = stringValue(value.influence);
  const sourceScope = stringValue(value.sourceScope);
  const materialType = stringValue(value.materialType);
  const evidenceLevel = stringValue(value.evidenceLevel);
  if (
    !id ||
    !sourceDocumentId ||
    !title ||
    !excerpt ||
    !influence ||
    !sourceScope ||
    !materialType ||
    !evidenceLevel ||
    !referenceSourceScopes.has(
      sourceScope as AppliedPedagogicalReference["sourceScope"]
    ) ||
    !referenceMaterialTypes.has(
      materialType as AppliedPedagogicalReference["materialType"]
    ) ||
    !referenceEvidenceLevels.has(
      evidenceLevel as AppliedPedagogicalReference["evidenceLevel"]
    )
  ) {
    return null;
  }

  return {
    id,
    sourceDocumentId,
    sourceRevisionId: stringValue(value.sourceRevisionId) || undefined,
    contentHash: stringValue(value.contentHash) || undefined,
    sourceScope:
      sourceScope as AppliedPedagogicalReference["sourceScope"],
    title,
    origin: stringValue(value.origin) || "Base acadêmica pessoal",
    discipline: stringValue(value.discipline) || undefined,
    materialType:
      materialType as AppliedPedagogicalReference["materialType"],
    evidenceLevel:
      evidenceLevel as AppliedPedagogicalReference["evidenceLevel"],
    documentType: referenceDocumentTypes.has(
      stringValue(value.documentType) as NonNullable<
        AppliedPedagogicalReference["documentType"]
      >
    )
      ? (stringValue(value.documentType) as NonNullable<
          AppliedPedagogicalReference["documentType"]
        >)
      : undefined,
    sourceDate: stringValue(value.sourceDate) || undefined,
    confidence:
      typeof value.confidence === "number" &&
      Number.isFinite(value.confidence) &&
      value.confidence >= 0 &&
      value.confidence <= 1
        ? value.confidence
        : undefined,
    period: stringValue(value.period) || undefined,
    isPrimaryPlanningSource:
      value.isPrimaryPlanningSource === true ? true : undefined,
    sourceKind: stringValue(value.sourceKind) || undefined,
    sourceLocation: stringValue(value.sourceLocation) || undefined,
    excerpt,
    influence,
    appliedAt: stringValue(value.appliedAt) || undefined,
  };
};

const parseDocumentSupport = (
  value: unknown
): SessionPlanningDocumentSupport | undefined => {
  if (!isRecord(value)) return undefined;
  const status =
    value.status === "available" ||
    value.status === "no_relevant_content" ||
    value.status === "unavailable"
      ? value.status
      : "unavailable";
  const actionContractValue = isRecord(value.actionContract)
    ? value.actionContract
    : null;
  const validActionContract =
    actionContractValue?.mode === "read_only" &&
    actionContractValue?.requiresExplicitConfirmation === true &&
    actionContractValue?.canWrite === false;

  return {
    status,
    references: Array.isArray(value.references)
      ? value.references
          .map(parseAppliedReference)
          .filter(
            (
              reference
            ): reference is AppliedPedagogicalReference => Boolean(reference)
          )
      : [],
    warnings: stringArray(value.warnings),
    retrievalMode:
      value.retrievalMode === "semantic" ||
      value.retrievalMode === "lexical_fallback" ||
      value.retrievalMode === "contextual"
        ? value.retrievalMode
        : undefined,
    actionDate: stringValue(value.actionDate) || undefined,
    actionContract: validActionContract
      ? (actionContractValue as unknown as DocumentReadOnlyActionContract)
      : undefined,
  };
};

export const parseSessionPlanningContext = (
  value: unknown
): ParsedSessionPlanningContext => {
  if (!isRecord(value)) {
    return {
      status: "invalid",
      context: null,
      warnings: ["sessionPlanningContext ausente ou inválido."],
    };
  }

  const classId = stringValue(value.classId);
  const sessionDate = stringValue(value.sessionDate);
  const ageBand = stringValue(value.ageBand);
  const skillFocus = value.skillFocus;

  if (!classId || !sessionDate || !ageBand || !isVolleyballSkill(skillFocus)) {
    return {
      status: "invalid",
      context: null,
      warnings: ["sessionPlanningContext não possui campos mínimos válidos."],
    };
  }

  const warnings: string[] = [];
  const schemaVersion = numberValue(value.schemaVersion);
  const status = schemaVersion === SESSION_PLANNING_CONTEXT_SCHEMA_VERSION ? "current" : "legacy";
  if (status === "legacy") {
    warnings.push("sessionPlanningContext legado sem schemaVersion atual.");
  }

  const classProfile = isRecord(value.classProfile) ? value.classProfile : {};
  const periodizationPhase = stringValue(value.periodizationPhase);
  const context: SessionPlanningContext = {
    schemaVersion: SESSION_PLANNING_CONTEXT_SCHEMA_VERSION,
    classId,
    sessionDate,
    ageBand,
    sport: "volleyball",
    skillFocus,
    secondarySkill: isVolleyballSkill(value.secondarySkill) ? value.secondarySkill : undefined,
    cycleGoal: stringValue(value.cycleGoal) || undefined,
    weekGoal: stringValue(value.weekGoal) || undefined,
    weekNumber: numberValue(value.weekNumber),
    sessionIndexInWeek: numberValue(value.sessionIndexInWeek),
    periodizationPhase: periodizationPhase
      ? (periodizationPhase as SessionPlanningContext["periodizationPhase"])
      : undefined,
    progressionDimension:
      (stringValue(value.progressionDimension) as ProgressionDimension) || "consistencia",
    pedagogicalIntent:
      (stringValue(value.pedagogicalIntent) as PedagogicalIntent) || "technical_adjustment",
    loadIntent: (stringValue(value.loadIntent) as WeeklyLoadIntent) || "moderado",
    previousSessionSummary: stringValue(value.previousSessionSummary) || undefined,
    recentDifficulties: stringArray(value.recentDifficulties),
    recentActivityFamilies: stringArray(value.recentActivityFamilies),
    recentActivityNames: stringArray(value.recentActivityNames),
    recentActivityPatternIds: stringArray(value.recentActivityPatternIds),
    upcomingEvents: Array.isArray(value.upcomingEvents)
      ? value.upcomingEvents
          .filter(isRecord)
          .map((event) => ({
            title: stringValue(event.title),
            date: stringValue(event.date),
            classScoped: Boolean(event.classScoped),
          }))
          .filter((event) => event.title && event.date)
      : [],
    availableDuration: numberValue(value.availableDuration) ?? 60,
    materials: stringArray(value.materials),
    classProfile: {
      level: numberValue(classProfile.level) ?? 1,
      daysPerWeek: numberValue(classProfile.daysPerWeek) ?? 1,
      size: numberValue(classProfile.size) ?? 0,
      heterogeneity: stringValue(classProfile.heterogeneity) || "desconhecida",
    },
    constraints: stringArray(value.constraints),
    dailyPlanAnchor: parseDailyPlanAnchor(value.dailyPlanAnchor),
    readinessState: isRecord(value.readinessState)
      ? (value.readinessState as ClassReadinessState)
      : undefined,
    adaptiveEnvelope: isRecord(value.adaptiveEnvelope)
      ? (value.adaptiveEnvelope as AdaptiveLessonEnvelope)
      : undefined,
    coachGuidance: isRecord(value.coachGuidance)
      ? (value.coachGuidance as SessionCoachGuidance)
      : undefined,
    documentSupport:
      parseDocumentSupport(value.documentSupport) ??
      parseDocumentSupport(value.academicSupport),
  };

  return { status, context, warnings };
};

export const summarizeReportFeedbackSignals = (
  signals: PedagogicalFeedbackSignal[]
): ReportFeedbackSignal | undefined => {
  const uniqueSignals = [...new Set(signals)];
  if (!uniqueSignals.length) return undefined;

  return {
    participationLevel: uniqueSignals.includes("low_participation") ? "low" : "normal",
    techniqueSignal: uniqueSignals.includes("recurring_technical_difficulty")
      ? "recurring_difficulty"
      : "stable",
    classClimate: uniqueSignals.includes("emotional_conflict")
      ? "conflict"
      : uniqueSignals.includes("class_agitation")
      ? "agitated"
      : "stable",
    loadSignal: uniqueSignals.includes("low_frequency") ? "low_frequency" : "normal",
    notes: uniqueSignals,
  };
};
