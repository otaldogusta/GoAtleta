import type {
  ClassGroup,
  CycleDayPlanningContext,
  PedagogicalIntent,
  ProgressionDimension,
  SessionStrategy,
  TrainingPlan,
  VolleyballSkill,
  WeeklyLoadIntent,
} from "./models";

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

export type SessionPlanningContext = {
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
};

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
  upcomingEvents?: SessionPlanningUpcomingEvent[];
}): SessionPlanningContext => {
  const recentPlans = [...(params.recentPlans ?? [])].slice(0, 5);
  const recentDifficulties = uniqueStrings(
    recentPlans.flatMap((plan) => deriveRecentDifficulty(plan))
  );
  const recentActivityFamilies = uniqueStrings(
    recentPlans.map((plan) => deriveRecentActivityFamily(plan))
  ).slice(0, 5);

  return {
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
    constraints: [...params.cycleContext.constraints],
  };
};
