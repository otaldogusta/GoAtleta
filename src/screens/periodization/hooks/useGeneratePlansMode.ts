import { useCallback } from "react";

import {
    toCompetitiveClassPlans,
} from "../../../core/competitive-periodization";
import type {
    ClassCalendarException,
    ClassCompetitiveProfile,
    ClassGroup,
    ClassPlan,
    PlanningCycle,
} from "../../../core/models";
import type { PeriodizationModel, SportProfile } from "../../../core/periodization-basics";
import {
    isAnnualCycle,
} from "../../../core/periodization-basics";
import {
    toAnnualClassPlans,
    toClassPlans,
} from "../../../core/periodization-generator";
import {
    deleteClassPlansByClass,
    getClassPlansByClass,
    saveClassPlans,
    updateClassPlan,
} from "../../../db/seed";
import { logAction } from "../../../observability/breadcrumbs";
import { measure } from "../../../observability/perf";

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export type UseGeneratePlansModeParams = {
  selectedClass: ClassGroup | null;
  activeCycleId: string;
  activeCycleYear: number | null;
  cycleLength: number;
  activeCycleStartDate: string;
  isCompetitiveMode: boolean;
  ageBand: "06-08" | "09-11" | "12-14";
  periodizationModel: PeriodizationModel;
  weeklySessions: number;
  sportProfile: SportProfile;
  calendarExceptions: ClassCalendarException[];
  competitiveProfile: ClassCompetitiveProfile | null;
  buildAutoPlanForWeek: (weekNumber: number, existing?: ClassPlan | null) => ClassPlan | null;
  refreshPlans: () => Promise<void>;
  setClassPlans: (plans: ClassPlan[]) => void;
  setIsSavingPlans: (value: boolean) => void;
};

export type GenerationCycleIdentity = Pick<
  PlanningCycle,
  "id" | "year" | "startDate"
>;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGeneratePlansMode({
  selectedClass,
  activeCycleId,
  activeCycleYear,
  cycleLength,
  activeCycleStartDate,
  isCompetitiveMode,
  ageBand,
  periodizationModel,
  weeklySessions,
  sportProfile,
  calendarExceptions,
  competitiveProfile,
  buildAutoPlanForWeek,
  refreshPlans,
  setClassPlans,
  setIsSavingPlans,
}: UseGeneratePlansModeParams) {
  const handleGenerateMode = useCallback(
    async (
      mode: "fill" | "auto" | "all",
      cycleOverride?: GenerationCycleIdentity,
    ) => {
      if (!selectedClass) return;

      const resolvedCycleId = String(cycleOverride?.id ?? activeCycleId).trim();
      const resolvedCycleYear = cycleOverride?.year ?? activeCycleYear;
      const resolvedCycleStartDate = String(
        cycleOverride?.startDate ?? activeCycleStartDate,
      ).trim();
      if (!resolvedCycleId) {
        throw new Error(
          "O ciclo ativo ainda não foi vinculado. Salve os parâmetros da periodização e tente novamente.",
        );
      }
      if (!resolvedCycleYear || !resolvedCycleStartDate) {
        throw new Error(
          "O ciclo ativo está incompleto. Revise o ano e a data de início antes de gerar a periodização.",
        );
      }

      setIsSavingPlans(true);

      try {
        const existing = await getClassPlansByClass(selectedClass.id, {
          cycleId: resolvedCycleId,
          cycleYear: resolvedCycleYear,
        });

        const byWeek = new Map(existing.map((plan) => [plan.weekNumber, plan]));

        if (mode === "all") {
          const plans = isCompetitiveMode
            ? toCompetitiveClassPlans({
                classId: selectedClass.id,
                cycleLength,
                cycleStartDate: resolvedCycleStartDate,
                daysOfWeek: selectedClass.daysOfWeek ?? [],
                exceptions: calendarExceptions,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                profile: competitiveProfile!,
              })
            : isAnnualCycle(cycleLength)
              ? toAnnualClassPlans({
                  classId: selectedClass.id,
                  ageBand,
                  cycleLength,
                  startDate: resolvedCycleStartDate,
                  mvLevel: selectedClass.mvLevel,
                  model: periodizationModel,
                  sessionsPerWeek: weeklySessions,
                  sport: sportProfile,
                })
            : toClassPlans({
                classId: selectedClass.id,
                ageBand,
                cycleLength,
                startDate: resolvedCycleStartDate,
                mvLevel: selectedClass.mvLevel,
                model: periodizationModel,
                sessionsPerWeek: weeklySessions,
                sport: sportProfile,
              });

          await measure("deleteClassPlansByClass", () =>
            deleteClassPlansByClass(selectedClass.id, {
              cycleId: resolvedCycleId,
              cycleYear: resolvedCycleYear,
            })
          );

          const plansWithCycle = plans.map((plan) => ({
            ...plan,
            cycleId: resolvedCycleId,
          }));

          await measure("saveClassPlans", () => saveClassPlans(plansWithCycle));

          setClassPlans(plansWithCycle);

          logAction("Regerar planejamento", {
            classId: selectedClass.id,
            weeks: plansWithCycle.length,
          });

          return;
        }

        const toCreate: ClassPlan[] = [];

        const toUpdate: ClassPlan[] = [];

        for (let week = 1; week <= cycleLength; week += 1) {
          const existingPlan = byWeek.get(week) ?? null;

          if (!existingPlan) {
            const plan = buildAutoPlanForWeek(week);

            if (plan) toCreate.push({ ...plan, cycleId: resolvedCycleId });

            continue;
          }

          if (mode === "auto" && existingPlan.source === "AUTO") {
            const plan = buildAutoPlanForWeek(week, existingPlan);

            if (plan) {
              plan.cycleId = resolvedCycleId;
              plan.updatedAt = new Date().toISOString();

              toUpdate.push(plan);
            }
          }
        }

        if (toCreate.length) {
          await measure("saveClassPlans", () => saveClassPlans(toCreate));
        }

        if (toUpdate.length) {
          await Promise.all(
            toUpdate.map((plan) => measure("updateClassPlan", () => updateClassPlan(plan)))
          );
        }

        await refreshPlans();
      } finally {
        setIsSavingPlans(false);
      }
    },
    [
      activeCycleStartDate,
      activeCycleId,
      activeCycleYear,
      ageBand,
      buildAutoPlanForWeek,
      calendarExceptions,
      competitiveProfile,
      cycleLength,
      isCompetitiveMode,
      periodizationModel,
      sportProfile,
      refreshPlans,
      selectedClass,
      weeklySessions,
      setClassPlans,
      setIsSavingPlans,
    ]
  );

  return { handleGenerateMode };
}
