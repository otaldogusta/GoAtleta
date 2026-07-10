import { useCallback, useEffect, useMemo, useState } from "react";

import type { ClassCalendarException, ClassGroup, ClassPlan, PlanningCycle } from "../../../core/models";
import { ensureActiveCycleForYear, getActivePlanningCycle } from "../../../db/cycles";
import { getClassById, getClassCalendarExceptions, getClassPlansByClass } from "../../../db/seed";
import { buildMonthPlanningSummaries } from "../application/month-planning-summary";

const toIsoDate = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return "";
};

const isWithinWindow = (date: string, startDate: string, endDate: string) =>
  Boolean(date && startDate && endDate && date >= startDate && date <= endDate);

const OPTIONAL_CLASS_PLANNING_DATA_TIMEOUT_MS = 6000;

const loadOptionalClassPlanningData = async <T,>(label: string, promise: Promise<T>, fallback: T): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`Class planning optional data timed out: ${label}`);
      resolve(fallback);
    }, OPTIONAL_CLASS_PLANNING_DATA_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    console.warn(`Class planning optional data failed: ${label}`, error);
    return fallback;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

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

export function useClassPlanning(classId: string) {
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [activeCycle, setActiveCycle] = useState<PlanningCycle | null>(null);
  const [classPlans, setClassPlans] = useState<ClassPlan[]>([]);
  const [calendarExceptions, setCalendarExceptions] = useState<ClassCalendarException[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!classId) {
      setSelectedClass(null);
      setActiveCycle(null);
      setClassPlans([]);
      setCalendarExceptions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cls = await getClassById(classId);
      if (!cls?.organizationId) {
        throw new Error("Turma sem workspace ativo.");
      }
      const currentYear = new Date().getFullYear();
      const classStartDate = cls?.cycleStartDate || cls?.createdAt || null;
      await ensureActiveCycleForYear(
        classId,
        cls.organizationId,
        currentYear,
        classStartDate
      );
      const activeCycle = await getActivePlanningCycle(classId, cls.organizationId);
      const cycleYear = activeCycle?.year ?? null;
      const plans = await getClassPlansByClass(classId, {
        cycleId: activeCycle?.id ?? null,
        cycleYear,
      });
      const exceptions = cls
        ? await loadOptionalClassPlanningData(
            "calendar exceptions",
            getClassCalendarExceptions(classId, { organizationId: cls.organizationId ?? null }),
            []
          )
        : [];

      const windowStart = toIsoDate(activeCycle?.startDate);
      const windowEnd = toIsoDate(activeCycle?.endDate);
      const scopedPlans = filterPlansByCycleWindow(plans, {
        activeCycleId: String(activeCycle?.id ?? ""),
        startDate: windowStart,
        endDate: windowEnd,
      });

      setSelectedClass(cls);
      setActiveCycle(activeCycle);
      setClassPlans(dedupeWeeklyPlans(scopedPlans));
      setCalendarExceptions(exceptions);
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
    () => buildMonthPlanningSummaries(classPlans, selectedClass, activeCycle, calendarExceptions),
    [activeCycle, calendarExceptions, classPlans, selectedClass]
  );

  return {
    selectedClass,
    activeCycle,
    classPlans,
    calendarExceptions,
    months,
    isLoading,
    error,
    reload: load,
  };
}
