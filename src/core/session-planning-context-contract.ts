import type {
  CycleDayPlanningContext,
  PedagogicalFeedbackSignal,
  PedagogicalIntent,
  ProgressionDimension,
  VolleyballSkill,
  WeeklyLoadIntent,
} from "./models";

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
  upcomingEvents: SessionPlanningUpcomingEvent[];
  availableDuration: number;
  materials: string[];
  classProfile: SessionPlanningClassProfile;
  constraints: string[];
  reportFeedback?: ReportFeedbackSignal;
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
