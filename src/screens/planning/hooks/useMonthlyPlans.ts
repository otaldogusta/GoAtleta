import { useCallback, useEffect, useMemo, useState } from "react";

import type { ClassGroup, ClassPlan, DailyLessonPlan, PlanningCycle } from "../../../core/models";
import { ensureActiveCycleForYear, getActivePlanningCycle } from "../../../db/cycles";
import { getClassById, getClassPlansByClass, listDailyLessonPlansByWeekIds } from "../../../db/seed";
import {
  buildPlanSessions,
  filterPlansWithSessionsInMonth,
  filterSessionsInMonth,
  toMonthKey,
} from "../application/monthly-session-filter";
import type { WeekSessionPreview } from "../../periodization/application/build-week-session-preview";

export type WeeklyPlanningItem = {
  plan: ClassPlan;
  label: string;
  weekStartLabel: string;
  weekEndLabel: string;
  sessions: WeekSessionPreview[];
};

export type DailyLessonPlanLookup = Record<string, DailyLessonPlan>;

const formatDatePt = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
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

const buildWeeklyItems = (plans: ClassPlan[], selectedClass: ClassGroup | null, monthKey: string): WeeklyPlanningItem[] => {
  return plans
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((plan) => {
      const allSessions = buildPlanSessions(plan, selectedClass);
      const sessions = allSessions.length > 0 ? filterSessionsInMonth(allSessions, monthKey) : allSessions;
      const weekStartLabel = sessions[0]?.dateLabel ?? formatDatePt(plan.startDate);
      const weekEndLabel = sessions[sessions.length - 1]?.dateLabel ?? formatDatePt(plan.startDate);

      return {
        plan,
        sessions,
        weekStartLabel,
        weekEndLabel,
        label: `Semana ${String(plan.weekNumber).padStart(2, "0")}`,
      };
    });
};

export function useMonthlyPlans(classId: string, monthKey: string) {
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [activeCycle, setActiveCycle] = useState<PlanningCycle | null>(null);
  const [classPlans, setClassPlans] = useState<ClassPlan[]>([]);
  const [dailyPlansByKey, setDailyPlansByKey] = useState<DailyLessonPlanLookup>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!classId) {
      setSelectedClass(null);
      setActiveCycle(null);
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
      const scopedPlans = dedupeWeeklyPlans(
        filterPlansByCycleWindow(plans, {
          activeCycleId: String(activeCycle?.id ?? ""),
          startDate: windowStart,
          endDate: windowEnd,
        })
      );

      setSelectedClass(cls);
      setActiveCycle(activeCycle);
      setClassPlans(scopedPlans);

      const monthPlans = filterPlansWithSessionsInMonth(scopedPlans, cls, monthKey);
      const weekIds = monthPlans.map((plan) => plan.id);
      const dailyPlans = await listDailyLessonPlansByWeekIds(weekIds);
      const mapped: DailyLessonPlanLookup = {};
      for (const plan of dailyPlans) {
        mapped[`${plan.weeklyPlanId}::${plan.date}`] = plan;
      }
      setDailyPlansByKey(mapped);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar o mês.");
    } finally {
      setIsLoading(false);
    }
  }, [classId, monthKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthPlans = useMemo(
    () => filterPlansWithSessionsInMonth(classPlans, selectedClass, monthKey),
    [classPlans, monthKey, selectedClass]
  );

  const weeklyItems = useMemo(
    () => buildWeeklyItems(monthPlans, selectedClass, monthKey),
    [monthPlans, selectedClass, monthKey]
  );

  return {
    selectedClass,
    activeCycle,
    weeklyItems,
    dailyPlansByKey,
    isLoading,
    error,
    reload: load,
  };
}
