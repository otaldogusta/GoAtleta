import type {
  ClassGroup,
  AdaptiveLessonEnvelope,
  ClassReadinessState,
  CycleDayPlanningContext,
  RecentSessionSummary,
  SessionCoachGuidance,
  SessionStrategy,
  TrainingPlan,
  VolleyballSkill,
} from "./models";
import {
  SESSION_PLANNING_CONTEXT_SCHEMA_VERSION,
  summarizeReportFeedbackSignals,
  type SessionPlanningContext,
  type SessionPlanningDailyPlanAnchor,
  type SessionPlanningUpcomingEvent,
} from "./session-planning-context-contract";

export type {
  ParsedSessionPlanningContext,
  ReportFeedbackSignal,
  SessionPlanningClassProfile,
  SessionPlanningContext,
  SessionPlanningDailyPlanAnchor,
  SessionPlanningUpcomingEvent,
} from "./session-planning-context-contract";
export {
  parseSessionPlanningContext,
  SESSION_PLANNING_CONTEXT_SCHEMA_VERSION,
} from "./session-planning-context-contract";

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const deriveRecentActivityFamily = (plan: TrainingPlan): string => {
  const text = normalizeText(
    [
      plan.title,
      ...(plan.warmup ?? []),
      ...(plan.main ?? []),
      ...(plan.cooldown ?? []),
      plan.pedagogy?.focus?.skill,
      plan.pedagogy?.progression?.dimension,
      plan.pedagogy?.sessionObjective,
    ].join(" ")
  );

  if (/jogo reduz|mini|rally|ponto extra|jogo aplicado/.test(text)) return "jogo_aplicado";
  if (/alvo|zona|direc/.test(text)) return "alvo_zona";
  if (/dupla|trio|cooper|continuidade|jogavel|jogável/.test(text)) return "cooperacao";
  if (/desloc|corr|cobre|cobertura|transicao/.test(text)) return "deslocamento";
  if (/saque|sacar|sacador/.test(text)) return "saque_direcionado";
  if (/estacao|circuito/.test(text)) return "estacoes";
  return "bloco_tecnico";
};

const deriveRecentDifficulty = (plan: TrainingPlan): string[] => {
  const text = normalizeText(
    [
      plan.title,
      plan.pedagogy?.sessionObjective,
      plan.pedagogy?.pedagogicalDecisionSupport?.teacherFacingSummary,
      ...(plan.pedagogy?.pedagogicalDecisionSupport?.riskFlags.map((risk) => risk.reason) ?? []),
      ...(plan.pedagogy?.learningObjectives?.pedagogicalGuidelines ?? []),
    ].join(" ")
  );

  return uniqueStrings([
    /comunic|cham/.test(text) ? "comunicacao" : null,
    /baixa particip|pouca particip|fila|espera/.test(text) ? "participacao" : null,
    /dificuldade|falha|erro|instavel|instável/.test(text) ? "dificuldade_tecnica" : null,
    /decis|leitura|escolh/.test(text) ? "tomada_decisao" : null,
    /cobertura|organiz/.test(text) ? "organizacao" : null,
  ]);
};

const summarizePreviousSession = (plan: TrainingPlan | undefined) => {
  if (!plan) return undefined;
  return uniqueStrings([
    plan.pedagogy?.sessionObjective,
    plan.pedagogy?.focus?.skill,
    plan.pedagogy?.progression?.dimension,
    plan.main?.[0],
  ]).join(" | ");
};

export const buildSessionPlanningContext = (params: {
  classGroup: ClassGroup;
  cycleContext: CycleDayPlanningContext;
  strategy: SessionStrategy;
  recentPlans?: TrainingPlan[];
  recentSessions?: RecentSessionSummary[];
  upcomingEvents?: SessionPlanningUpcomingEvent[];
  dailyPlanAnchor?: SessionPlanningDailyPlanAnchor | null;
  readinessState?: ClassReadinessState;
  adaptiveEnvelope?: AdaptiveLessonEnvelope;
  coachGuidance?: SessionCoachGuidance;
}): SessionPlanningContext => {
  const recentPlans = [...(params.recentPlans ?? [])].slice(0, 5);
  const recentDifficulties = uniqueStrings(
    recentPlans.flatMap((plan) => deriveRecentDifficulty(plan))
  );
  const recentActivityFamilies = uniqueStrings(
    recentPlans.map((plan) => deriveRecentActivityFamily(plan))
  ).slice(0, 5);
  const reportFeedback = summarizeReportFeedbackSignals(
    (params.recentSessions ?? []).flatMap((session) => session.pedagogicalFeedbackSignals ?? [])
  );

  return {
    schemaVersion: SESSION_PLANNING_CONTEXT_SCHEMA_VERSION,
    classId: params.cycleContext.classId,
    sessionDate: params.cycleContext.sessionDate,
    ageBand: params.cycleContext.ageBand,
    sport: "volleyball",
    skillFocus: params.strategy.primarySkill,
    secondarySkill: params.strategy.secondarySkill,
    cycleGoal: params.classGroup.goal,
    weekGoal: uniqueStrings([
      params.cycleContext.classGoal,
      params.cycleContext.weeklyOperationalDecision?.quarterFocus,
    ])[0],
    weekNumber: params.cycleContext.weekNumber,
    sessionIndexInWeek: params.cycleContext.sessionIndexInWeek,
    periodizationPhase: params.cycleContext.planningPhase,
    progressionDimension: params.strategy.progressionDimension,
    pedagogicalIntent: params.strategy.pedagogicalIntent,
    loadIntent: params.strategy.loadIntent,
    previousSessionSummary: summarizePreviousSession(recentPlans[0]),
    recentDifficulties,
    recentActivityFamilies,
    upcomingEvents: [...(params.upcomingEvents ?? [])],
    availableDuration: params.cycleContext.duration,
    materials: [...params.cycleContext.materials],
    classProfile: {
      level: params.cycleContext.classLevel,
      daysPerWeek: params.cycleContext.daysPerWeek,
      size: 0,
      heterogeneity:
        params.cycleContext.historicalConfidence === "none" ? "desconhecida" : "contextualizada",
    },
    constraints: uniqueStrings([
      ...params.cycleContext.constraints,
      ...(params.dailyPlanAnchor?.constraintHints ?? []),
    ]),
    ...(params.dailyPlanAnchor ? { dailyPlanAnchor: params.dailyPlanAnchor } : {}),
    ...(reportFeedback ? { reportFeedback } : {}),
    ...(params.readinessState ? { readinessState: params.readinessState } : {}),
    ...(params.adaptiveEnvelope ? { adaptiveEnvelope: params.adaptiveEnvelope } : {}),
    ...(params.coachGuidance ? { coachGuidance: params.coachGuidance } : {}),
  };
};
