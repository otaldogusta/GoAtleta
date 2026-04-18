import { useCallback, useEffect, useMemo, useState } from "react";

import type { ClassGroup, ClassPlan } from "../../../core/models";
import { ensureActiveCycleForYear, getActivePlanningCycle } from "../../../db/cycles";
import { getClassById, getClassPlansByClass } from "../../../db/seed";

export type MonthPlanningSummary = {
  monthKey: string;
  label: string;
  year: number;
  month: number;
  weekCount: number;
  estimatedLessonCount: number;
};

const parseMonthKey = (startDate: string) => {
  const date = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return {
    year,
    month,
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date),
  };
};

const toIsoDate = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return "";
};

const isWithinWindow = (date: string, startDate: string, endDate: string) =>
  Boolean(date && startDate && endDate && date >= startDate && date <= endDate);

const filterPlansByCycleWindow = (plans: ClassPlan[], options: {
  activeCycleId: string;
  startDate: string;
  endDate: string;
}) => {
  const { activeCycleId, startDate, endDate } = options;
  if (!startDate || !endDate) return plans;

  return plans.filter((plan) => {
    const planDate = toIsoDate(plan.startDate);
    if (!planDate) return false;
    const planCycleId = String(plan.cycleId ?? "").trim();

    if (activeCycleId && planCycleId === activeCycleId) return true;
    if (!planCycleId && isWithinWindow(planDate, startDate, endDate)) return true;
    return false;
  });
};

const dedupeWeeklyPlans = (plans: ClassPlan[]) => {
  const byWeek = new Map<string, ClassPlan>();
  for (const plan of plans) {
    const key = `${plan.weekNumber}|${toIsoDate(plan.startDate)}`;
    const existing = byWeek.get(key);
    if (!existing) {
      byWeek.set(key, plan);
      continue;
    }
    const currentUpdated = toIsoDate(plan.updatedAt || plan.createdAt);
    const existingUpdated = toIsoDate(existing.updatedAt || existing.createdAt);
    if (currentUpdated >= existingUpdated) {
      byWeek.set(key, plan);
    }
  }
  return [...byWeek.values()].sort((a, b) => a.weekNumber - b.weekNumber);
};

const toMonthSummary = (plans: ClassPlan[], selectedClass: ClassGroup | null): MonthPlanningSummary[] => {
  const byMonth = new Map<string, MonthPlanningSummary>();
  const sessionsPerWeek = selectedClass?.daysOfWeek?.length || selectedClass?.daysPerWeek || 0;

  for (const plan of plans) {
    const month = parseMonthKey(plan.startDate);
    if (!month) continue;
    const existing = byMonth.get(month.monthKey);
    if (existing) {
      existing.weekCount += 1;
      existing.estimatedLessonCount += sessionsPerWeek;
      continue;
    }
    byMonth.set(month.monthKey, {
      monthKey: month.monthKey,
      label: month.label,
      year: month.year,
      month: month.month,
      weekCount: 1,
      estimatedLessonCount: sessionsPerWeek,
    });
  }

  return [...byMonth.values()].sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));
};

export function useClassPlanning(classId: string) {
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [classPlans, setClassPlans] = useState<ClassPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!classId) {
      setSelectedClass(null);
      setClassPlans([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cls = await getClassById(classId);
      const currentYear = new Date().getFullYear();
      const classStartDate = cls?.cycleStartDate || cls?.createdAt || null;
      await ensureActiveCycleForYear(classId, currentYear, classStartDate);
      const activeCycle = await getActivePlanningCycle(classId);
      const cycleYear = activeCycle?.year ?? null;
      const plans = await getClassPlansByClass(classId, {
        cycleId: activeCycle?.id ?? null,
        cycleYear,
      });

      const windowStart = toIsoDate(activeCycle?.startDate);
      const windowEnd = toIsoDate(activeCycle?.endDate);
      const scopedPlans = filterPlansByCycleWindow(plans, {
        activeCycleId: String(activeCycle?.id ?? ""),
        startDate: windowStart,
        endDate: windowEnd,
      });

      setSelectedClass(cls);
      setClassPlans(dedupeWeeklyPlans(scopedPlans));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar planejamentos.");
    } finally {
      setIsLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const months = useMemo(
    () => toMonthSummary(classPlans, selectedClass),
    [classPlans, selectedClass]
  );

  return {
    selectedClass,
    classPlans,
    months,
    isLoading,
    error,
    reload: load,
  };
}
