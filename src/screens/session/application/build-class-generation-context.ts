import { buildCycleDayPlanningContext } from "../../../core/cycle-day-planning/build-cycle-day-planning-context";
import type {
    ClassGroup,
    ClassPlan,
    DominantGapType,
    PedagogicalIntent,
    PhaseIntent,
    ProgressionDimension,
    Student,
    TrainingPlan,
    TrainingPlanDevelopmentStage,
    VolleyballSkill,
    WeeklyLoadIntent,
} from "../../../core/models";
import type { PlanningPhase } from "../../../core/pedagogical-planning";
import { type ScoutingCounts } from "../../../core/scouting";
import { buildRecentSessionSummary } from "./build-recent-session-summary";

export type { DominantGapType, PedagogicalIntent, PhaseIntent, WeeklyLoadIntent };

export type ClassGenerationContext = {
  classId: string;
  sessionDate: string;
  modality: string;
  classLevel: number;
  ageBand: string;
  developmentStage: TrainingPlanDevelopmentStage;
  planningPhase?: PlanningPhase;
  weekNumber?: number;
  rpeTarget?: number;
  phaseIntent: PhaseIntent;
  weeklyLoadIntent: WeeklyLoadIntent;
  primarySkill: VolleyballSkill;
  secondarySkill?: VolleyballSkill;
  progressionDimensionTarget: ProgressionDimension;
  pedagogicalIntent: PedagogicalIntent;
  recentSkills: VolleyballSkill[];
  recentProgressionDimensions: ProgressionDimension[];
  recentObjectives: string[];
  recentPlanHashes: string[];
  dominantGapSkill?: VolleyballSkill;
  dominantGapType?: DominantGapType;
  mustAvoidRepeating: string[];
  mustProgressFrom?: string;
  duration: number;
  materials: string[];
  constraints: string[];
  allowedDrillFamilies: string[];
  forbiddenDrillFamilies: string[];
};

type BuildClassGenerationContextParams = {
  classGroup: ClassGroup;
  classPlan?: ClassPlan | null;
  students: Student[];
  sessionDate: string;
  scoutingCounts?: ScoutingCounts | null;
  recentPlans?: TrainingPlan[];
};





const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];





































const resolveRecentObjectives = (recentPlans: TrainingPlan[]) =>
  uniqueStrings(
    recentPlans.map(
      (plan) =>
        plan.pedagogy?.sessionObjective ||
        plan.pedagogy?.objective?.description ||
        plan.title
    )
  ).slice(0, 5);





export function buildClassGenerationContext(
  params: BuildClassGenerationContextParams
): ClassGenerationContext {
  const recentPlans = [...(params.recentPlans ?? [])].slice(0, 5);
  const recentSessions = buildRecentSessionSummary({
    classId: params.classGroup.id,
    plans: recentPlans,
    limit: 5,
  });
  const cycleContext = buildCycleDayPlanningContext({
    classGroup: params.classGroup,
    classPlan: params.classPlan,
    sessionDate: params.sessionDate,
    recentSessions,
    scoutingCounts: params.scoutingCounts,
  });
  const recentSkills = recentPlans
    .map((plan) => plan.pedagogy?.focus?.skill)
    .filter((skill): skill is VolleyballSkill => Boolean(skill));
  const recentProgressionDimensions = recentPlans
    .map((plan) => plan.pedagogy?.progression?.dimension)
    .filter((dimension): dimension is ProgressionDimension => Boolean(dimension));

  return {
    classId: cycleContext.classId,
    sessionDate: cycleContext.sessionDate,
    modality: cycleContext.modality ?? "",
    classLevel: cycleContext.classLevel,
    ageBand: cycleContext.ageBand ?? "",
    developmentStage: cycleContext.developmentStage,
    planningPhase: cycleContext.planningPhase,
    weekNumber: cycleContext.weekNumber,
    rpeTarget: cycleContext.targetPse,
    phaseIntent: cycleContext.phaseIntent,
    weeklyLoadIntent: cycleContext.weeklyLoadIntent,
    primarySkill: cycleContext.primarySkill,
    secondarySkill: cycleContext.secondarySkill,
    progressionDimensionTarget: cycleContext.progressionDimensionTarget,
    pedagogicalIntent: cycleContext.pedagogicalIntent,
    recentSkills,
    recentProgressionDimensions,
    recentObjectives: resolveRecentObjectives(recentPlans),
    recentPlanHashes: uniqueStrings(recentPlans.map((plan) => plan.inputHash)).slice(0, 5),
    dominantGapSkill: cycleContext.dominantGapSkill,
    dominantGapType: cycleContext.dominantGapType,
    mustAvoidRepeating: cycleContext.mustAvoidRepeating,
    mustProgressFrom: cycleContext.mustProgressFrom,
    duration: cycleContext.duration,
    materials: cycleContext.materials,
    constraints: cycleContext.constraints,
    allowedDrillFamilies: cycleContext.allowedDrillFamilies,
    forbiddenDrillFamilies: cycleContext.forbiddenDrillFamilies,
  };
}
