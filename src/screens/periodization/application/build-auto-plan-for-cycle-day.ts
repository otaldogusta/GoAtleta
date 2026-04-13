import { applyPlanGuards } from "../../../core/cycle-day-planning/apply-plan-guards";
import type { GenerationHistoryMode } from "../../../core/cycle-day-planning/format-generation-explanation";
import { formatGenerationExplanation } from "../../../core/cycle-day-planning/format-generation-explanation";
import { resolveOrderedTrainingDays } from "../../../core/cycle-day-planning/resolve-session-index-in-week";
import { resolveSessionStrategyDecisionFromCycleContext } from "../../../core/cycle-day-planning/resolve-session-strategy-from-cycle-context";
import type {
    ClassGroup,
    ClassPlan,
    HistoricalConfidence,
    RecentSessionSummary,
    RepetitionAdjustment,
    SessionStrategy,
    VolleyballSkill,
} from "../../../core/models";
import {
    dayLabels,
    dayNumbersByLabelIndex,
    weekAgendaDayOrder,
    type PeriodizationModel,
    type SportProfile,
    type VolumeLevel,
} from "../../../core/periodization-basics";
import { buildPeriodizationCycleDayPlanningContext } from "./build-cycle-day-planning-context";

type PeriodizationWeekPlanInput = {
  week: number;
  title: string;
  focus: string;
  volume: VolumeLevel;
  notes: string[];
  jumpTarget: string;
  PSETarget: string;
  plannedSessionLoad: number;
  plannedWeeklyLoad: number;
  source: "AUTO" | "MANUAL";
};

export type BuildPeriodizationAutoPlanForCycleDayParams = {
  classGroup: ClassGroup;
  classPlan?: ClassPlan | null;
  weekPlan: PeriodizationWeekPlanInput;
  cycleStartDate: string;
  sessionDate: string;
  periodizationModel: PeriodizationModel;
  sportProfile: SportProfile;
  weeklySessions: number;
  dominantBlock?: string;
  macroLabel?: string;
  mesoLabel?: string;
  recentSessions?: RecentSessionSummary[] | null;
};

export type PeriodizationAutoPlanForCycleDayResult = {
  sessionDate: string;
  sessionIndexInWeek: number;
  historicalConfidence: HistoricalConfidence;
  historyMode: GenerationHistoryMode;
  fingerprint: string;
  structuralFingerprint: string;
  repetitionAdjustment: RepetitionAdjustment;
  strategy: SessionStrategy;
  sessionLabel: string;
  primarySkillLabel: string;
  progressionLabel: string;
  pedagogicalIntentLabel: string;
  coachSummary: string;
  explanationSummary: string;
  drillFamiliesLabel: string;
  debugSignals?: PeriodizationDebugSignals;
};

export type PeriodizationDebugSignals = {
  adapterInput: {
    classId: string;
    className: string;
    goal: string;
    level: number;
    ageBand: string;
    modality: string;
    gender: string;
    unit: string;
    mvLevel: string;
    weeklySessions: number;
    week: number;
    focus: string;
    volume: string;
    plannedSessionLoad: number;
    plannedWeeklyLoad: number;
    dominantBlock?: string;
    macroLabel?: string;
    mesoLabel?: string;
    sessionDate: string;
  };
  cycleContext: {
    classGoal?: string;
    planningPhase?: string;
    weekNumber?: number;
    phaseIntent: string;
    weeklyLoadIntent: string;
    pedagogicalIntent: string;
    classLevel: number;
    developmentStage: string;
    targetPse?: number;
    dominantBlock?: string;
    dominantGapSkill?: string;
    dominantGapType?: string;
    mustAvoidRepeating: string[];
    mustProgressFrom?: string;
    constraints: string[];
    materials: string[];
  };
  strategy: {
    primarySkill: string;
    secondarySkill?: string;
    progressionDimension: string;
    pedagogicalIntent: string;
    loadIntent: string;
    drillFamilies: string[];
    forbiddenDrillFamilies: string[];
    decisionComplexity: number;
    timePressureLevel: number;
    variabilityLevel: number;
  };
};

export type PeriodizationWeekScheduleItem = {
  label: string;
  dayNumber: number;
  date: string;
  session: string;
  summary: string;
  sessionIndexInWeek?: number;
  autoPlan?: PeriodizationAutoPlanForCycleDayResult | null;
};

const formatSkillLabel = (skill?: VolleyballSkill) => {
  if (!skill) return "Sessao";
  const labels: Record<VolleyballSkill, string> = {
    passe: "Passe",
    levantamento: "Levantamento",
    ataque: "Ataque",
    bloqueio: "Bloqueio",
    defesa: "Defesa",
    saque: "Saque",
    transicao: "Transicao",
  };
  return labels[skill] ?? skill;
};

const formatProgressionLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatPedagogicalIntentLabel = (value: string) => {
  const labels: Record<string, string> = {
    decision_making: "Tomada de decisao",
    game_reading: "Leitura de jogo",
    team_organization: "Organizacao",
    technical_adjustment: "Ajuste tecnico",
    pressure_adaptation: "Adaptacao a pressao",
  };
  return labels[value] ?? formatProgressionLabel(value);
};

const formatIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveWeekStartDate = (cycleStartDate: string, weekNumber: number) => {
  const parsed = new Date(`${cycleStartDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  const next = new Date(parsed);
  next.setDate(parsed.getDate() + Math.max(0, weekNumber - 1) * 7);
  return next;
};

const resolveDateForWeekday = (weekStartDate: Date, normalizedDay: number) => {
  const startWeekday = weekStartDate.getDay() === 0 ? 7 : weekStartDate.getDay();
  const next = new Date(weekStartDate);
  next.setDate(weekStartDate.getDate() + (normalizedDay - startWeekday));
  return next;
};

const fallbackTrainingDaysByFrequency: Record<number, number[]> = {
  1: [3],
  2: [1, 3],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

const resolveTrainingDaysForWeek = (classGroup: ClassGroup, weeklySessions: number) => {
  const orderedDays = resolveOrderedTrainingDays(classGroup.daysOfWeek);
  if (orderedDays.length) {
    return orderedDays.slice(0, Math.max(1, Math.min(weeklySessions, orderedDays.length)));
  }

  const frequency = Math.max(1, Math.min(7, weeklySessions || classGroup.daysPerWeek || 1));
  return fallbackTrainingDaysByFrequency[frequency] ?? fallbackTrainingDaysByFrequency[2];
};

const buildPeriodizationDebugSignals = (params: BuildPeriodizationAutoPlanForCycleDayParams, result: {
  cycleContext: ReturnType<typeof buildPeriodizationCycleDayPlanningContext>["cycleContext"];
  strategy: SessionStrategy;
}): PeriodizationDebugSignals => ({
  adapterInput: {
    classId: params.classGroup.id,
    className: params.classGroup.name,
    goal: params.classGroup.goal,
    level: params.classGroup.level,
    ageBand: params.classGroup.ageBand,
    modality: params.classGroup.modality,
    gender: params.classGroup.gender,
    unit: params.classGroup.unit,
    mvLevel: params.classGroup.mvLevel,
    weeklySessions: params.weeklySessions,
    week: params.weekPlan.week,
    focus: params.weekPlan.focus,
    volume: params.weekPlan.volume,
    plannedSessionLoad: params.weekPlan.plannedSessionLoad,
    plannedWeeklyLoad: params.weekPlan.plannedWeeklyLoad,
    dominantBlock: params.dominantBlock,
    macroLabel: params.macroLabel,
    mesoLabel: params.mesoLabel,
    sessionDate: params.sessionDate,
  },
  cycleContext: {
    classGoal: result.cycleContext.classGoal,
    planningPhase: result.cycleContext.planningPhase,
    weekNumber: result.cycleContext.weekNumber,
    phaseIntent: result.cycleContext.phaseIntent,
    weeklyLoadIntent: result.cycleContext.weeklyLoadIntent,
    pedagogicalIntent: result.cycleContext.pedagogicalIntent,
    classLevel: result.cycleContext.classLevel,
    developmentStage: result.cycleContext.developmentStage,
    targetPse: result.cycleContext.targetPse,
    dominantBlock: result.cycleContext.dominantBlock,
    dominantGapSkill: result.cycleContext.dominantGapSkill,
    dominantGapType: result.cycleContext.dominantGapType,
    mustAvoidRepeating: [...result.cycleContext.mustAvoidRepeating],
    mustProgressFrom: result.cycleContext.mustProgressFrom,
    constraints: [...result.cycleContext.constraints],
    materials: [...result.cycleContext.materials],
  },
  strategy: {
    primarySkill: result.strategy.primarySkill,
    secondarySkill: result.strategy.secondarySkill,
    progressionDimension: result.strategy.progressionDimension,
    pedagogicalIntent: result.strategy.pedagogicalIntent,
    loadIntent: result.strategy.loadIntent,
    drillFamilies: [...result.strategy.drillFamilies],
    forbiddenDrillFamilies: [...result.strategy.forbiddenDrillFamilies],
    decisionComplexity: result.strategy.decisionComplexity,
    timePressureLevel: result.strategy.timePressureLevel,
    variabilityLevel: result.strategy.variabilityLevel,
  },
});

export const buildPeriodizationAutoPlanForCycleDay = (
  params: BuildPeriodizationAutoPlanForCycleDayParams
): PeriodizationAutoPlanForCycleDayResult => {
  const context = buildPeriodizationCycleDayPlanningContext({
    classGroup: params.classGroup,
    classPlan: params.classPlan,
    weekPlan: params.weekPlan,
    sessionDate: params.sessionDate,
    periodizationModel: params.periodizationModel,
    sportProfile: params.sportProfile,
    weeklySessions: params.weeklySessions,
    dominantBlock: params.dominantBlock,
    macroLabel: params.macroLabel,
    mesoLabel: params.mesoLabel,
    recentSessions: params.recentSessions,
  });
  const strategyDecision = resolveSessionStrategyDecisionFromCycleContext(context.cycleContext);
  const guardResult = applyPlanGuards({
    context: context.cycleContext,
    strategy: strategyDecision.strategy,
    recentSessions: context.cycleContext.recentSessions,
  });
  const explanation = formatGenerationExplanation({
    cycleContext: context.cycleContext,
    baseStrategy: strategyDecision.baseStrategy,
    strategy: guardResult.strategy,
    fingerprint: guardResult.fingerprint,
    structuralFingerprint: guardResult.structuralFingerprint,
    repetitionAdjustment: guardResult.repetitionAdjustment,
    dominantBlockAdjusted: strategyDecision.dominantBlockAdjusted,
    dominantBlockInfluence: strategyDecision.dominantBlockInfluence,
    loadAdjusted: strategyDecision.loadAdjusted,
    loadInfluence: strategyDecision.loadInfluence,
    overrideAdjusted: strategyDecision.overrideAdjusted,
    overrideInfluence: strategyDecision.overrideInfluence,
  });
  const primarySkillLabel = formatSkillLabel(guardResult.strategy.primarySkill);
  const progressionLabel = formatProgressionLabel(guardResult.strategy.progressionDimension);
  const pedagogicalIntentLabel = formatPedagogicalIntentLabel(
    guardResult.strategy.pedagogicalIntent
  );

  return {
    sessionDate: params.sessionDate,
    sessionIndexInWeek: context.sessionIndexInWeek,
    historicalConfidence: context.cycleContext.historicalConfidence,
    historyMode: explanation.historyMode,
    fingerprint: guardResult.fingerprint,
    structuralFingerprint: guardResult.structuralFingerprint,
    repetitionAdjustment: guardResult.repetitionAdjustment,
    strategy: guardResult.strategy,
    sessionLabel: `${primarySkillLabel} · ${progressionLabel}`,
    primarySkillLabel,
    progressionLabel,
    pedagogicalIntentLabel,
    coachSummary: explanation.coachSummary,
    explanationSummary: explanation.summary,
    drillFamiliesLabel: guardResult.strategy.drillFamilies.join(", "),
    debugSignals: buildPeriodizationDebugSignals(params, {
      cycleContext: context.cycleContext,
      strategy: guardResult.strategy,
    }),
  };
};

const buildSyntheticRecentSession = (
  autoPlan: PeriodizationAutoPlanForCycleDayResult,
  dominantBlock?: string
): RecentSessionSummary => ({
  sessionDate: autoPlan.sessionDate,
  wasPlanned: true,
  wasApplied: false,
  wasEditedByTeacher: false,
  wasConfirmedExecuted: null,
  executionState: "planned_only",
  primarySkill: autoPlan.strategy.primarySkill,
  secondarySkill: autoPlan.strategy.secondarySkill,
  progressionDimension: autoPlan.strategy.progressionDimension,
  dominantBlock,
  fingerprint: autoPlan.fingerprint,
  structuralFingerprint: autoPlan.structuralFingerprint,
  teacherOverrideWeight: "none",
});

export const buildPeriodizationWeekSchedule = (params: {
  classGroup: ClassGroup | null;
  classPlan?: ClassPlan | null;
  weekPlan: PeriodizationWeekPlanInput | null;
  cycleStartDate: string;
  periodizationModel: PeriodizationModel;
  sportProfile: SportProfile;
  weeklySessions: number;
  dominantBlock?: string;
  macroLabel?: string;
  mesoLabel?: string;
  recentSessions?: RecentSessionSummary[] | null;
}) => {
  if (!params.classGroup || !params.weekPlan) {
    return weekAgendaDayOrder.map((dayNumber) => {
      const labelIndex = dayNumbersByLabelIndex.indexOf(dayNumber);
      return {
        label: labelIndex >= 0 ? dayLabels[labelIndex] : "--",
        dayNumber,
        date: "",
        session: "",
        summary: "",
      } satisfies PeriodizationWeekScheduleItem;
    });
  }

  const weekStartDate = resolveWeekStartDate(params.cycleStartDate, params.weekPlan.week);
  const trainingDays = resolveTrainingDaysForWeek(params.classGroup, params.weeklySessions);
  const syntheticRecentSessions = [...(params.recentSessions ?? [])];

  return weekAgendaDayOrder.map((dayNumber) => {
    const labelIndex = dayNumbersByLabelIndex.indexOf(dayNumber);
    const label = labelIndex >= 0 ? dayLabels[labelIndex] : "--";
    const normalizedDay = dayNumber === 0 ? 7 : dayNumber;
    const date = formatIsoDate(resolveDateForWeekday(weekStartDate, normalizedDay));

    if (!trainingDays.includes(normalizedDay)) {
      return {
        label,
        dayNumber,
        date,
        session: "",
        summary: "",
      } satisfies PeriodizationWeekScheduleItem;
    }

    const autoPlan = buildPeriodizationAutoPlanForCycleDay({
      classGroup: params.classGroup,
      classPlan: params.classPlan,
      weekPlan: params.weekPlan,
      cycleStartDate: params.cycleStartDate,
      sessionDate: date,
      periodizationModel: params.periodizationModel,
      sportProfile: params.sportProfile,
      weeklySessions: params.weeklySessions,
      dominantBlock: params.dominantBlock,
      macroLabel: params.macroLabel,
      mesoLabel: params.mesoLabel,
      recentSessions: syntheticRecentSessions,
    });

    syntheticRecentSessions.unshift(
      buildSyntheticRecentSession(autoPlan, params.dominantBlock)
    );

    return {
      label,
      dayNumber,
      date,
      session: autoPlan.sessionLabel,
      summary: autoPlan.coachSummary,
      sessionIndexInWeek: autoPlan.sessionIndexInWeek,
      autoPlan,
    } satisfies PeriodizationWeekScheduleItem;
  });
};
