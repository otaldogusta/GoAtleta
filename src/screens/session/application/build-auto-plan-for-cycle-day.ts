import { applyPlanGuards } from "../../../core/cycle-day-planning/apply-plan-guards";
import { buildCycleDayPlanningContext } from "../../../core/cycle-day-planning/build-cycle-day-planning-context";
import { buildDailyLessonPlanningAnchor } from "../../../core/cycle-day-planning/daily-lesson-planning-anchor";
import { formatGenerationExplanation, type CycleDayGenerationExplanation } from "../../../core/cycle-day-planning/format-generation-explanation";
import {
    buildSessionDecisionTrace,
    type SessionDecisionTrace,
} from "../../../core/cycle-day-planning/session-decision-trace";
import { resolvePedagogicalDecisionSupport } from "../../../core/cycle-day-planning/resolve-pedagogical-decision-support";
import { resolveSessionStrategyDecisionFromCycleContext } from "../../../core/cycle-day-planning/resolve-session-strategy-from-cycle-context";
import type { TeacherOverrideInfluence } from "../../../core/cycle-day-planning/resolve-teacher-override-weight";
import { detectSessionPedagogicalApproach } from "../../../core/methodology/session-pedagogical-language";
import {
    recommendActivityCatalogVariants,
    type ActivityCatalogRecommendation,
} from "../../../core/volleyball/activity-catalog";
import { resolveVolleyballLessonAgeProfile } from "../../../core/volleyball/humanized-lesson-activities";
import type {
    ClassGroup,
    ClassPlan,
    CycleDayPlanningContext,
    DailyLessonPlan,
    ProgressionDimension,
    RecentSessionSummary,
    RepetitionAdjustment,
    SessionLog,
    SessionStrategy,
    Student,
    TrainingPlan,
    TrainingSession,
    TrainingSessionAttendance,
    VolleyballSkill,
} from "../../../core/models";
import type { PedagogicalPlanPackage } from "../../../core/pedagogical-planning";
import {
    applySessionPedagogyEnvelope,
    resolveSessionPedagogyEnvelope,
    toSessionPedagogyEnvelopeDiagnostics,
    type SessionPedagogyEnvelopeDiagnostics,
} from "../../../core/resolve-session-pedagogy-envelope";
import {
    sanitizePlanForAgeBand,
    type AgeSanitizerDiagnostics,
} from "../../../core/sanitize-plan-for-age-band";
import {
    buildSessionPlanningContext,
    type SessionPlanningContext,
    type SessionPlanningUpcomingEvent,
} from "../../../core/session-planning-context";
import type { ScoutingCounts, ScoutingPlanningSignal } from "../../../core/scouting";
import type { ClassGenerationContext } from "./build-class-generation-context";
import { buildPedagogicalInputFromContext } from "./build-pedagogical-input-from-context";
import { buildRecentSessionSummary } from "./build-recent-session-summary";

export type BuildAutoPlanForCycleDayParams = {
  classGroup: ClassGroup;
  classPlan?: ClassPlan | null;
  dailyLessonPlan?: DailyLessonPlan | null;
  students: Student[];
  sessionDate: string;
  scoutingCounts?: ScoutingCounts | null;
  scoutingSignal?: ScoutingPlanningSignal | null;
  recentPlans?: TrainingPlan[] | null;
  recentSessions?: RecentSessionSummary[] | null;
  sessions?: TrainingSession[] | null;
  attendance?: TrainingSessionAttendance[] | null;
  sessionLogs?: SessionLog[] | null;
  upcomingEvents?: SessionPlanningUpcomingEvent[] | null;
  sessionIndexInWeek?: number;
  variationSeed?: number;
  dimensionGuidelines?: string[];
};

export type AutoPlanForCycleDayResult = {
  recentSessions: RecentSessionSummary[];
  cycleContext: CycleDayPlanningContext;
  baseStrategy: SessionStrategy;
  strategy: SessionStrategy;
  overrideAdjusted: boolean;
  overrideInfluence: TeacherOverrideInfluence;
  fingerprint: string;
  structuralFingerprint: string;
  repetitionAdjustment: RepetitionAdjustment;
  explanation: CycleDayGenerationExplanation;
  decisionTrace: SessionDecisionTrace;
  activityCatalogRecommendations: ActivityCatalogRecommendation[];
  generationContext: ClassGenerationContext;
  sessionPlanningContext: SessionPlanningContext;
  package: PedagogicalPlanPackage;
  ageSanitizer: AgeSanitizerDiagnostics;
  pedagogyEnvelope: SessionPedagogyEnvelopeDiagnostics;
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const resolveRecentSkills = (recentSessions: RecentSessionSummary[]) =>
  recentSessions
    .map((session) => session.primarySkill)
    .filter((skill): skill is VolleyballSkill => Boolean(skill));

const resolveRecentProgressionDimensions = (recentSessions: RecentSessionSummary[]) =>
  recentSessions
    .map((session) => session.progressionDimension)
    .filter((dimension): dimension is ProgressionDimension => Boolean(dimension));

const resolveRecentObjectives = (recentPlans: TrainingPlan[]) =>
  uniqueStrings(
    recentPlans.map(
      (plan) =>
        plan.pedagogy?.sessionObjective ||
        plan.pedagogy?.objective?.description ||
        plan.title
    )
  ).slice(0, 5);

const adaptCycleStrategyToGenerationContext = (params: {
  cycleContext: CycleDayPlanningContext;
  strategy: SessionStrategy;
  recentSessions: RecentSessionSummary[];
  recentPlans: TrainingPlan[];
}): ClassGenerationContext => {
  const recentSkills = resolveRecentSkills(params.recentSessions);
  const recentProgressionDimensions = resolveRecentProgressionDimensions(params.recentSessions);

  return {
    classId: params.cycleContext.classId,
    sessionDate: params.cycleContext.sessionDate,
    modality: params.cycleContext.modality,
    classLevel: params.cycleContext.classLevel,
    ageBand: params.cycleContext.ageBand,
    developmentStage: params.cycleContext.developmentStage,
    planningPhase: params.cycleContext.planningPhase,
    weekNumber: params.cycleContext.weekNumber,
    rpeTarget: params.cycleContext.targetPse,
    phaseIntent: params.cycleContext.phaseIntent,
    weeklyLoadIntent: params.strategy.loadIntent,
    primarySkill: params.strategy.primarySkill,
    secondarySkill: params.strategy.secondarySkill,
    progressionDimensionTarget: params.strategy.progressionDimension,
    pedagogicalIntent: params.strategy.pedagogicalIntent,
    recentSkills,
    recentProgressionDimensions,
    recentObjectives: resolveRecentObjectives(params.recentPlans),
    recentPlanHashes: uniqueStrings(params.recentPlans.map((plan) => plan.inputHash)).slice(0, 5),
    dominantGapSkill: params.cycleContext.dominantGapSkill,
    dominantGapType: params.cycleContext.dominantGapType,
    mustAvoidRepeating: params.cycleContext.mustAvoidRepeating,
    mustProgressFrom: params.cycleContext.mustProgressFrom,
    duration: params.cycleContext.duration,
    materials: params.cycleContext.materials,
    constraints: params.cycleContext.constraints,
    allowedDrillFamilies: params.strategy.drillFamilies,
    forbiddenDrillFamilies: params.strategy.forbiddenDrillFamilies,
  };
};

export const buildAutoPlanForCycleDay = (
  params: BuildAutoPlanForCycleDayParams
): AutoPlanForCycleDayResult => {
  const recentPlans = [...(params.recentPlans ?? [])].slice(0, 5);
  const dailyPlanAnchor = buildDailyLessonPlanningAnchor({
    dailyLessonPlan: params.dailyLessonPlan,
    sessionDate: params.sessionDate,
    ageBand: params.classGroup.ageBand,
  });
  const recentSessions =
    params.recentSessions ??
    buildRecentSessionSummary({
      classId: params.classGroup.id,
      plans: recentPlans,
      sessions: params.sessions,
      attendance: params.attendance,
      sessionLogs: params.sessionLogs,
      limit: 5,
    });

  const cycleContext = buildCycleDayPlanningContext({
    classGroup: params.classGroup,
    classPlan: params.classPlan,
    sessionDate: params.sessionDate,
    recentSessions,
    scoutingCounts: params.scoutingCounts,
    scoutingSignal: params.scoutingSignal,
    dailyPlanAnchor,
    sessionIndexInWeek: params.sessionIndexInWeek,
  });
  const strategyDecision = resolveSessionStrategyDecisionFromCycleContext(cycleContext);
  const guardResult = applyPlanGuards({
    context: cycleContext,
    strategy: strategyDecision.strategy,
    recentSessions,
    recentPlanHashes: uniqueStrings(recentPlans.map((plan) => plan.inputHash)).slice(0, 5),
  });
  const strategy = {
    ...guardResult.strategy,
    pedagogicalDecisionSupport: resolvePedagogicalDecisionSupport({
      context: cycleContext,
      strategy: guardResult.strategy,
    }),
  };
  const generationContext = adaptCycleStrategyToGenerationContext({
    cycleContext,
    strategy,
    recentSessions,
    recentPlans,
  });
  const activityCatalogRecommendations = recommendActivityCatalogVariants({
    primarySkill: strategy.primarySkill,
    secondarySkill: strategy.secondarySkill,
    ageStage: resolveVolleyballLessonAgeProfile(params.classGroup).stage,
    phaseIntent: cycleContext.phaseIntent,
    progressionDimension: strategy.progressionDimension,
    pedagogicalIntent: strategy.pedagogicalIntent,
    loadIntent: strategy.loadIntent,
    recentActivityFamilies: [
      ...cycleContext.mustAvoidRepeating,
      ...strategy.forbiddenDrillFamilies,
    ],
    materials: cycleContext.materials,
    recentDifficulties: [
      cycleContext.dominantGapSkill,
      cycleContext.dominantGapType,
      cycleContext.mustProgressFrom,
    ].filter((value): value is string => Boolean(value)),
  }).slice(0, 5);
  const sessionPlanningContext = buildSessionPlanningContext({
    classGroup: params.classGroup,
    cycleContext,
    strategy,
    recentPlans,
    recentSessions,
    upcomingEvents: params.upcomingEvents ?? [],
    dailyPlanAnchor,
  });
  sessionPlanningContext.classProfile.size = params.students.length;
  const pkg = buildPedagogicalInputFromContext({
    classGroup: params.classGroup,
    students: params.students,
    generationContext,
    sessionPlanningContext,
    variationSeed: params.variationSeed,
    dimensionGuidelines: params.dimensionGuidelines,
  });
  const approach = detectSessionPedagogicalApproach([
    pkg.input.objective,
    pkg.final.main.summary,
    ...pkg.final.main.activities.map((activity) => activity.name),
    ...pkg.final.cooldown.activities.map((activity) => activity.description),
  ]);
  const envelope = resolveSessionPedagogyEnvelope({
    ageBand: params.classGroup.ageBand,
    developmentStage: generationContext.developmentStage,
    pedagogicalApproach: approach,
    objectiveType: "tecnico",
    historyMode: cycleContext.historicalConfidence === "none"
      ? "bootstrap"
      : cycleContext.historicalConfidence === "high"
      ? "strong_history"
      : "partial_history",
  });
  const envelopedPlan = applySessionPedagogyEnvelope({
    plan: pkg,
    envelope,
    primarySkill: strategy.primarySkill,
    secondarySkill: strategy.secondarySkill,
  });
  const pedagogyEnvelope = toSessionPedagogyEnvelopeDiagnostics(envelope);
  const sanitizedPlan = sanitizePlanForAgeBand(
    envelopedPlan,
    params.classGroup.ageBand,
    generationContext.developmentStage
  );
  const explanation = formatGenerationExplanation({
    cycleContext,
    baseStrategy: strategyDecision.baseStrategy,
    strategy,
    fingerprint: guardResult.fingerprint,
    structuralFingerprint: guardResult.structuralFingerprint,
    repetitionAdjustment: guardResult.repetitionAdjustment,
    dominantBlockAdjusted: strategyDecision.dominantBlockAdjusted,
    dominantBlockInfluence: strategyDecision.dominantBlockInfluence,
    loadAdjusted: strategyDecision.loadAdjusted,
    loadInfluence: strategyDecision.loadInfluence,
    overrideAdjusted: strategyDecision.overrideAdjusted,
    overrideInfluence: strategyDecision.overrideInfluence,
    reportFeedbackAdjusted: strategyDecision.reportFeedbackAdjusted,
    reportFeedbackInfluence: strategyDecision.reportFeedbackInfluence,
    operationalAdjusted: strategyDecision.operationalAdjusted,
    operationalInfluence: strategyDecision.operationalInfluence,
  });
  const decisionTrace = buildSessionDecisionTrace({
    cycleContext,
    classPlan: params.classPlan,
    strategy,
    sessionPlanningContext,
    explanation,
    repetitionAdjustment: guardResult.repetitionAdjustment,
    overrideAdjusted: strategyDecision.overrideAdjusted,
    reportFeedbackInfluence: strategyDecision.reportFeedbackInfluence,
    scoutingCounts: params.scoutingCounts,
    scoutingSignal: params.scoutingSignal,
    dailyPlanAnchor,
    ageSanitizer: sanitizedPlan.diagnostics,
    pedagogyEnvelope,
  });

  return {
    recentSessions,
    cycleContext,
    baseStrategy: strategyDecision.baseStrategy,
    strategy,
    overrideAdjusted: strategyDecision.overrideAdjusted,
    overrideInfluence: strategyDecision.overrideInfluence,
    fingerprint: guardResult.fingerprint,
    structuralFingerprint: guardResult.structuralFingerprint,
    repetitionAdjustment: guardResult.repetitionAdjustment,
    explanation,
    decisionTrace,
    activityCatalogRecommendations,
    generationContext,
    sessionPlanningContext,
    package: sanitizedPlan.package,
    ageSanitizer: sanitizedPlan.diagnostics,
    pedagogyEnvelope,
  };
};
