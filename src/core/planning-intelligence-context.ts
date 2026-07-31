import type {
  ClassPlan,
  MonthlyPlanningBlueprint,
  PlanningCycle,
  RecentSessionSummary,
} from "./models";

export type PlanningIntelligenceLineage = {
  schemaVersion: 2;
  classId: string;
  cycleId: string | null;
  policyVersion: number;
  monthlyBlueprintId: string | null;
  monthlyBlueprintVersion: number | null;
  weeklyPlanId: string | null;
  weeklyPlanVersion: number | null;
  recentExecutedSessionDates: string[];
  generatedAt: string;
};

export const buildPlanningIntelligenceLineage = (params: {
  classId: string;
  cycle?: PlanningCycle | null;
  cycleId?: string | null;
  policyVersion?: number | null;
  blueprint?: MonthlyPlanningBlueprint | null;
  weeklyPlan?: ClassPlan | null;
  recentSessions?: RecentSessionSummary[] | null;
  generatedAt?: string;
}): PlanningIntelligenceLineage => ({
  schemaVersion: 2,
  classId: params.classId,
  cycleId: params.cycle?.id ?? params.cycleId ?? null,
  policyVersion:
    params.cycle?.policyVersion ?? params.policyVersion ?? 1,
  monthlyBlueprintId: params.blueprint?.id ?? null,
  monthlyBlueprintVersion: params.blueprint?.generationVersion ?? null,
  weeklyPlanId: params.weeklyPlan?.id ?? null,
  weeklyPlanVersion: params.weeklyPlan?.generationVersion ?? null,
  recentExecutedSessionDates: (params.recentSessions ?? [])
    .filter((session) => session.wasConfirmedExecuted || session.wasApplied)
    .map((session) => session.sessionDate)
    .filter(Boolean)
    .slice(0, 6),
  generatedAt: params.generatedAt ?? new Date().toISOString(),
});
