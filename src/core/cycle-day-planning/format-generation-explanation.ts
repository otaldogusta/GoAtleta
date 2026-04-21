import type {
    CycleDayPlanningContext,
    HistoricalConfidence,
    RepetitionAdjustment,
    SessionStrategy,
    TrainingPlanGenerationExplanation,
    TrainingPlanGenerationHistoryMode,
} from "../models";
import type { OperationalPedagogyInfluence } from "./apply-operational-pedagogy-rules";
import type { DominantBlockStrategyInfluence } from "./resolve-block-dominant-strategy";
import type { LoadModulationInfluence } from "./resolve-load-modulation";
import type { TeacherOverrideInfluence } from "./resolve-teacher-override-weight";

export type GenerationHistoryMode = TrainingPlanGenerationHistoryMode;

export type CycleDayGenerationExplanation = TrainingPlanGenerationExplanation & {
  debug: {
    historicalConfidence: HistoricalConfidence;
    historyMode: GenerationHistoryMode;
    planningPhase?: CycleDayPlanningContext["planningPhase"];
    phaseIntent: CycleDayPlanningContext["phaseIntent"];
    pedagogicalIntent: CycleDayPlanningContext["pedagogicalIntent"];
    weeklyLoadIntent: CycleDayPlanningContext["weeklyLoadIntent"];
    targetPse?: number;
    demandIndex?: number;
    plannedSessionLoad?: number;
    plannedWeeklyLoad?: number;
    dominantBlock?: string;
    dominantBlockProfileKey?: DominantBlockStrategyInfluence["key"];
    dominantBlockAdjusted: boolean;
    loadProfileKey: LoadModulationInfluence["key"];
    loadAdjusted: boolean;
    sessionIndexInWeek: number;
    daysPerWeek: number;
    recentSessionCount: number;
    recentAppliedCount: number;
    recentConfirmedCount: number;
    recentTeacherEditedCount: number;
    recentExecutionStates: string[];
    basePrimarySkill: SessionStrategy["primarySkill"];
    baseProgressionDimension: SessionStrategy["progressionDimension"];
    primarySkill: SessionStrategy["primarySkill"];
    secondarySkill?: SessionStrategy["secondarySkill"];
    progressionDimension: SessionStrategy["progressionDimension"];
    loadIntent: SessionStrategy["loadIntent"];
    drillFamilies: string[];
    forbiddenDrillFamilies: string[];
    overrideStrength: TeacherOverrideInfluence["strength"];
    overrideLearningWindowGenerations: TeacherOverrideInfluence["learningWindowGenerations"];
    overridePreferredMethodologyApproach?: TeacherOverrideInfluence["preferredMethodologyApproach"];
    overrideAdjusted: boolean;
    overridePreferredPrimarySkill?: TeacherOverrideInfluence["preferredPrimarySkill"];
    overridePreferredProgressionDimension?: TeacherOverrideInfluence["preferredProgressionDimension"];
    operationalAdjusted: boolean;
    operationalRulesApplied: string[];
    operationalChangedFields: string[];
    repetitionAdjustment: RepetitionAdjustment;
    fingerprint: string;
    structuralFingerprint: string;
  };
};

const guardReasonLabel = {
  recent_exact_clone: "clone recente",
  recent_plan_hash_repeat: "hash recente repetido",
  recent_structural_repeat: "estrutura recente repetida",
  same_week_structural_repeat: "estrutura repetida na mesma semana",
} as const;

type KnownGuardReason = keyof typeof guardReasonLabel;

const resolveGuardReasonLabel = (reason: RepetitionAdjustment["reason"]) => {
  if (!reason) return "repetição recente";
  return reason in guardReasonLabel
    ? guardReasonLabel[reason as KnownGuardReason]
    : "repetição recente";
};

const phaseIntentLabel: Record<CycleDayPlanningContext["phaseIntent"], string> = {
  exploracao_fundamentos: "Exploração de fundamentos",
  estabilizacao_tecnica: "Estabilização técnica",
  aceleracao_decisao: "Aceleração de decisão",
  transferencia_jogo: "Transferência para o jogo",
  pressao_competitiva: "Pressão competitiva",
};

const pedagogicalIntentLabel: Record<SessionStrategy["pedagogicalIntent"], string> = {
  decision_making: "tomada de decisão",
  game_reading: "leitura de jogo",
  team_organization: "organização coletiva",
  technical_adjustment: "ajuste técnico",
  pressure_adaptation: "adaptação à pressão",
};

const skillLabel: Record<SessionStrategy["primarySkill"], string> = {
  passe: "Passe",
  levantamento: "Levantamento",
  ataque: "Ataque",
  bloqueio: "Bloqueio",
  defesa: "Defesa",
  saque: "Saque",
  transicao: "Transição",
};

const overrideStrengthLabel: Record<TeacherOverrideInfluence["strength"], string> = {
  none: "sem sinal local",
  soft: "leve",
  medium: "médio",
  strong: "forte",
};

const resolveHistoryMode = (confidence: HistoricalConfidence): GenerationHistoryMode => {
  if (confidence === "none") return "bootstrap";
  if (confidence === "high") return "strong_history";
  return "partial_history";
};

const formatHistoryLabel = (historyMode: GenerationHistoryMode) => {
  if (historyMode === "bootstrap") return "Bootstrap";
  if (historyMode === "strong_history") return "Histórico forte";
  return "Histórico parcial";
};

const formatProgressionLabel = (value: SessionStrategy["progressionDimension"]) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatLoadLabel = (value: string) => value.replace(/^carga\s+/i, "");

const buildFocusReason = (strategy: SessionStrategy) =>
  `${pedagogicalIntentLabel[strategy.pedagogicalIntent]} com progressão em ${formatProgressionLabel(
    strategy.progressionDimension
  )}`;

const buildCoachSummary = (params: {
  historyMode: GenerationHistoryMode;
  phaseIntent: CycleDayPlanningContext["phaseIntent"];
  sessionIndexInWeek: number;
  daysPerWeek: number;
  strategy: SessionStrategy;
  overrideAdjusted: boolean;
  overrideInfluence: TeacherOverrideInfluence;
  dominantBlockAdjusted: boolean;
  dominantBlockInfluence: DominantBlockStrategyInfluence;
  loadAdjusted: boolean;
  loadInfluence: LoadModulationInfluence;
  repetitionAdjustment: RepetitionAdjustment;
}) => {
  const sentences = [
    `${formatHistoryLabel(params.historyMode)} na fase ${phaseIntentLabel[params.phaseIntent]}. Sessão ${params.sessionIndexInWeek}/${params.daysPerWeek} com foco em ${skillLabel[params.strategy.primarySkill]} para ${buildFocusReason(params.strategy)}.`,
  ];

  if (params.overrideAdjusted) {
    if (params.overrideInfluence.learningWindowGenerations > 0) {
      sentences.push(
        `Aprendizado local do professor (${overrideStrengthLabel[params.overrideInfluence.strength]}) segue pelas próximas ${params.overrideInfluence.learningWindowGenerations} gerações.`
      );
    } else {
      sentences.push(
        `Aprendizado local do professor (${overrideStrengthLabel[params.overrideInfluence.strength]}) aplicado.`
      );
    }
  } else if (
    params.overrideInfluence.strength !== "none" &&
    params.overrideInfluence.learningWindowGenerations > 0
  ) {
    sentences.push(
      `Aprendizado local do professor observado para ${params.overrideInfluence.learningWindowGenerations} gerações.`
    );
  }

  if (params.dominantBlockAdjusted && params.dominantBlockInfluence.label) {
    sentences.push(`Bloco ${params.dominantBlockInfluence.label.toLowerCase()} priorizado.`);
  }

  if (params.loadInfluence.key !== "balanced") {
    const verb = params.loadAdjusted ? "aplicada" : "mantida";
    sentences.push(
      `Carga ${formatLoadLabel(params.loadInfluence.label).toLowerCase()} ${verb}.`
    );
  }

  if (params.repetitionAdjustment.detected) {
    const reasonLabel = resolveGuardReasonLabel(params.repetitionAdjustment.reason);
    sentences.push(`Variação anti-repetição aplicada por ${reasonLabel}.`);
  }

  return sentences.join(" ");
};

export const formatGenerationExplanation = (params: {
  cycleContext: CycleDayPlanningContext;
  baseStrategy: SessionStrategy;
  strategy: SessionStrategy;
  fingerprint: string;
  structuralFingerprint: string;
  repetitionAdjustment: RepetitionAdjustment;
  dominantBlockAdjusted: boolean;
  dominantBlockInfluence: DominantBlockStrategyInfluence;
  loadAdjusted: boolean;
  loadInfluence: LoadModulationInfluence;
  overrideAdjusted: boolean;
  overrideInfluence: TeacherOverrideInfluence;
  operationalAdjusted: boolean;
  operationalInfluence: OperationalPedagogyInfluence;
}): CycleDayGenerationExplanation => {
  const historyMode = resolveHistoryMode(params.cycleContext.historicalConfidence);
  const recentSessions = params.cycleContext.recentSessions;
  const recentAppliedCount = recentSessions.filter((session) => session.wasApplied).length;
  const recentConfirmedCount = recentSessions.filter((session) => session.wasConfirmedExecuted).length;
  const recentTeacherEditedCount = recentSessions.filter((session) => session.wasEditedByTeacher).length;
  const sessionIndexInWeek = Math.max(1, params.cycleContext.sessionIndexInWeek || 1);
  const daysPerWeek = Math.max(1, params.cycleContext.daysPerWeek || 1);
  const fragments = [
    `${formatHistoryLabel(historyMode)} na fase ${phaseIntentLabel[params.cycleContext.phaseIntent]}`,
    `sessão ${sessionIndexInWeek}/${daysPerWeek}`,
    `foco em ${skillLabel[params.strategy.primarySkill]}`,
    `motivo ${buildFocusReason(params.strategy)}`,
  ];

  if (params.overrideAdjusted) {
    fragments.push(
      `aprendizado local do professor (${overrideStrengthLabel[params.overrideInfluence.strength]}) aplicado`
    );
  } else if (params.overrideInfluence.strength !== "none") {
    fragments.push(
      `aprendizado local do professor (${overrideStrengthLabel[params.overrideInfluence.strength]}) observado`
    );
  }

  if (params.operationalAdjusted && params.operationalInfluence.rulesApplied.length) {
    fragments.push(`regras operacionais: ${params.operationalInfluence.rulesApplied.join(", ")}`);
  }

  if (
    params.overrideInfluence.strength !== "none" &&
    params.overrideInfluence.learningWindowGenerations > 0
  ) {
    fragments.push(`aprendizado local ${params.overrideInfluence.learningWindowGenerations} gerações`);
  }

  if (params.dominantBlockAdjusted && params.dominantBlockInfluence.label) {
    fragments.push(`bloco ${params.dominantBlockInfluence.label.toLowerCase()} priorizado`);
  }

  if (params.loadInfluence.key !== "balanced") {
    const verb = params.loadAdjusted ? "aplicada" : "mantida";
    fragments.push(`carga ${formatLoadLabel(params.loadInfluence.label).toLowerCase()} ${verb}`);
  }

  if (params.repetitionAdjustment.detected) {
    const reasonLabel = resolveGuardReasonLabel(params.repetitionAdjustment.reason);
    fragments.push(`variação anti-repetição aplicada por ${reasonLabel}`);
  }

  const summary = fragments.join("; ");
  const coachSummary = buildCoachSummary({
    historyMode,
    phaseIntent: params.cycleContext.phaseIntent,
    sessionIndexInWeek,
    daysPerWeek,
    strategy: params.strategy,
    overrideAdjusted: params.overrideAdjusted,
    overrideInfluence: params.overrideInfluence,
    dominantBlockAdjusted: params.dominantBlockAdjusted,
    dominantBlockInfluence: params.dominantBlockInfluence,
    loadAdjusted: params.loadAdjusted,
    loadInfluence: params.loadInfluence,
    repetitionAdjustment: params.repetitionAdjustment,
  });

  return {
    historyMode,
    summary,
    coachSummary,
    debug: {
      historicalConfidence: params.cycleContext.historicalConfidence,
      historyMode,
      planningPhase: params.cycleContext.planningPhase,
      phaseIntent: params.cycleContext.phaseIntent,
      pedagogicalIntent: params.strategy.pedagogicalIntent,
      weeklyLoadIntent: params.cycleContext.weeklyLoadIntent,
      targetPse: params.cycleContext.targetPse,
      demandIndex: params.cycleContext.demandIndex,
      plannedSessionLoad: params.cycleContext.plannedSessionLoad,
      plannedWeeklyLoad: params.cycleContext.plannedWeeklyLoad,
      dominantBlock: params.cycleContext.dominantBlock,
      dominantBlockProfileKey: params.dominantBlockInfluence.key,
      dominantBlockAdjusted: params.dominantBlockAdjusted,
      loadProfileKey: params.loadInfluence.key,
      loadAdjusted: params.loadAdjusted,
      sessionIndexInWeek,
      daysPerWeek,
      recentSessionCount: recentSessions.length,
      recentAppliedCount,
      recentConfirmedCount,
      recentTeacherEditedCount,
      recentExecutionStates: recentSessions
        .slice(0, 3)
        .map((session) => `${session.sessionDate}:${session.executionState}`),
      basePrimarySkill: params.baseStrategy.primarySkill,
      baseProgressionDimension: params.baseStrategy.progressionDimension,
      primarySkill: params.strategy.primarySkill,
      secondarySkill: params.strategy.secondarySkill,
      progressionDimension: params.strategy.progressionDimension,
      loadIntent: params.strategy.loadIntent,
      drillFamilies: [...params.strategy.drillFamilies],
      forbiddenDrillFamilies: [...params.strategy.forbiddenDrillFamilies],
      overrideStrength: params.overrideInfluence.strength,
      overrideLearningWindowGenerations: params.overrideInfluence.learningWindowGenerations,
      overridePreferredMethodologyApproach:
        params.overrideInfluence.preferredMethodologyApproach,
      overrideAdjusted: params.overrideAdjusted,
      overridePreferredPrimarySkill: params.overrideInfluence.preferredPrimarySkill,
      overridePreferredProgressionDimension:
        params.overrideInfluence.preferredProgressionDimension,
      operationalAdjusted: params.operationalAdjusted,
      operationalRulesApplied: [...params.operationalInfluence.rulesApplied],
      operationalChangedFields: [...params.operationalInfluence.changedFields],
      repetitionAdjustment: {
        ...params.repetitionAdjustment,
        changedFields: [...params.repetitionAdjustment.changedFields],
      },
      fingerprint: params.fingerprint,
      structuralFingerprint: params.structuralFingerprint,
    },
  };
};
