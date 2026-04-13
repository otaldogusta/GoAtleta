import { buildCompetitiveClassPlan } from "../../core/competitive-periodization";
import type {
    ClassCalendarException,
    ClassCompetitiveProfile,
    ClassGroup,
    ClassPlan,
} from "../../core/models";
import type {
    PeriodizationModel,
    SportProfile,
} from "../../core/periodization-basics";
import { getDemandIndexForModel } from "../../core/periodization-basics";
import { buildClassPlan, getVolumeFromTargets } from "../../core/periodization-generator";
import { getPlannedLoads } from "../../core/periodization-load";
import { buildPeriodizationWeekSchedule } from "./application/build-auto-plan-for-cycle-day";

type BuildAutoWeekPlanParams = {
  selectedClass: ClassGroup | null;
  weekNumber: number;
  existing?: ClassPlan | null;
  cycleLength: number;
  activeCycleStartDate: string;
  isCompetitiveMode: boolean;
  calendarExceptions: ClassCalendarException[];
  competitiveProfile: ClassCompetitiveProfile | null;
  ageBand: "06-08" | "09-11" | "12-14";
  periodizationModel: PeriodizationModel;
  weeklySessions: number;
  sportProfile: SportProfile;
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const buildWeekPlanMeta = (params: {
  plan: ClassPlan;
  weekNumber: number;
  weeklySessions: number;
  sportProfile: SportProfile;
  durationMinutes: number;
}) => {
  const volume = getVolumeFromTargets(params.plan.phase, params.plan.rpeTarget);
  const plannedLoads = getPlannedLoads(
    params.plan.rpeTarget,
    Math.max(15, params.durationMinutes),
    params.weeklySessions
  );

  return {
    week: params.weekNumber,
    title: params.plan.phase,
    focus: params.plan.theme,
    volume,
    notes: [params.plan.constraints, params.plan.warmupProfile].filter(Boolean),
    jumpTarget: params.plan.jumpTarget,
    PSETarget: params.plan.rpeTarget,
    plannedSessionLoad: plannedLoads.plannedSessionLoad,
    plannedWeeklyLoad: plannedLoads.plannedWeeklyLoad,
    source: params.plan.source,
  };
};

export const buildAutoWeekPlan = (
  params: BuildAutoWeekPlanParams
): ClassPlan | null => {
  const { selectedClass, existing } = params;

  if (!selectedClass) return null;

  const plan = params.isCompetitiveMode
    ? params.competitiveProfile
      ? buildCompetitiveClassPlan({
          classId: selectedClass.id,
          weekNumber: params.weekNumber,
          cycleLength: params.cycleLength,
          cycleStartDate: params.activeCycleStartDate,
          daysOfWeek: selectedClass.daysOfWeek ?? [],
          exceptions: params.calendarExceptions,
          profile: params.competitiveProfile,
          source: "AUTO",
          existingId: existing?.id,
          existingCreatedAt: existing?.createdAt,
        })
      : null
    : buildClassPlan({
        classId: selectedClass.id,
        ageBand: params.ageBand,
        startDate: params.activeCycleStartDate,
        weekNumber: params.weekNumber,
        source: "AUTO",
        mvLevel: selectedClass.mvLevel,
        cycleLength: params.cycleLength,
        model: params.periodizationModel,
        sessionsPerWeek: params.weeklySessions,
        sport: params.sportProfile,
      });

  if (!plan) return null;

  if (!params.isCompetitiveMode) {
    const weekPlan = buildWeekPlanMeta({
      plan,
      weekNumber: params.weekNumber,
      weeklySessions: params.weeklySessions,
      sportProfile: params.sportProfile,
      durationMinutes: selectedClass.durationMinutes,
    });
    const demandIndex = getDemandIndexForModel(
      weekPlan.volume,
      params.periodizationModel,
      params.weeklySessions,
      params.sportProfile
    );
    const periodizationWeek = buildPeriodizationWeekSchedule({
      classGroup: selectedClass,
      classPlan: plan,
      weekPlan,
      cycleStartDate: params.activeCycleStartDate,
      periodizationModel: params.periodizationModel,
      sportProfile: params.sportProfile,
      weeklySessions: params.weeklySessions,
    });
    const autoPlans = periodizationWeek
      .map((item) => item.autoPlan)
      .filter((item): item is NonNullable<(typeof periodizationWeek)[number]["autoPlan"]> => Boolean(item));

    if (autoPlans.length) {
      const skillLabels = uniqueStrings(autoPlans.map((item) => item.primarySkillLabel)).slice(0, 2);
      const sessionLabels = uniqueStrings(autoPlans.map((item) => item.sessionLabel)).slice(0, 2);
      const progressionLabels = uniqueStrings(autoPlans.map((item) => item.progressionLabel)).slice(0, 2);
      const sessionSummary = autoPlans
        .slice(0, 3)
        .map((item) => `S${item.sessionIndexInWeek}: ${item.sessionLabel}`)
        .join(" | ");

      plan.theme = sessionLabels.join(" / ") || plan.theme;
      plan.technicalFocus = skillLabels.join(" / ") || plan.technicalFocus;
      plan.warmupProfile = autoPlans[0]?.pedagogicalIntentLabel || plan.warmupProfile;
      plan.constraints = uniqueStrings([
        plan.constraints,
        progressionLabels.length ? `Progressao: ${progressionLabels.join(" / ")}` : null,
        sessionSummary,
        `Demanda ${demandIndex}/10`,
      ])
        .slice(0, 4)
        .join(" | ");
    }
  }

  if (existing) {
    plan.id = existing.id;
    plan.createdAt = existing.createdAt;
  }

  return plan;
};
