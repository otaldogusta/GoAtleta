import { useCallback } from "react";

import {
  toCompetitiveClassPlans,
} from "../../../core/competitive-periodization";
import type {
  ClassCalendarException,
  ClassCompetitiveProfile,
  ClassGroup,
  ClassPlan,
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
  setShowGenerateModal: (value: boolean) => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGeneratePlansMode({
  selectedClass,
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
  setShowGenerateModal,
}: UseGeneratePlansModeParams) {
  const handleGenerateMode = useCallback(
    async (mode: "fill" | "auto" | "all") => {
      if (!selectedClass) return;

      setIsSavingPlans(true);

      try {
        const existing = await getClassPlansByClass(selectedClass.id);

        const byWeek = new Map(existing.map((plan) => [plan.weekNumber, plan]));

        if (mode === "all") {
          const plans = isCompetitiveMode
            ? toCompetitiveClassPlans({
                classId: selectedClass.id,
                cycleLength,
                cycleStartDate: activeCycleStartDate,
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
                  startDate: activeCycleStartDate,
                  mvLevel: selectedClass.mvLevel,
                  model: periodizationModel,
                  sessionsPerWeek: weeklySessions,
                  sport: sportProfile,
                })
            : toClassPlans({
                classId: selectedClass.id,
                ageBand,
                cycleLength,
                startDate: activeCycleStartDate,
                mvLevel: selectedClass.mvLevel,
                model: periodizationModel,
                sessionsPerWeek: weeklySessions,
                sport: sportProfile,
              });

          await measure("deleteClassPlansByClass", () =>
            deleteClassPlansByClass(selectedClass.id)
          );

          await measure("saveClassPlans", () => saveClassPlans(plans));

          setClassPlans(plans);

          logAction("Regerar planejamento", {
            classId: selectedClass.id,
            weeks: plans.length,
          });

          return;
        }

        const toCreate: ClassPlan[] = [];

        const toUpdate: ClassPlan[] = [];

        for (let week = 1; week <= cycleLength; week += 1) {
          const existingPlan = byWeek.get(week) ?? null;

          if (!existingPlan) {
            const plan = buildAutoPlanForWeek(week);

            if (plan) toCreate.push(plan);

            continue;
          }

          if (mode === "auto" && existingPlan.source === "AUTO") {
            const plan = buildAutoPlanForWeek(week, existingPlan);

            if (plan) {
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

        setShowGenerateModal(false);
      }
    },
    [
      activeCycleStartDate,
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
      setShowGenerateModal,
    ]
  );

  return { handleGenerateMode };
}
