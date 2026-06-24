import type { ClassCalendarException, ClassGroup, ClassPlan, PlanningCycle } from "../../../core/models";
import { buildPlanSessionCalendar } from "./monthly-plan-calendar";

export type MonthPlanningSummary = {
  monthKey: string;
  label: string;
  year: number;
  month: number;
  weekCount: number;
  estimatedLessonCount: number;
  hasPlans: boolean;
};

const parseIsoDate = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? raw
    : /^\d{4}-\d{2}-\d{2}T/.test(raw)
      ? raw.slice(0, 10)
      : "";
  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toMonthDescriptor = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return {
    year,
    month,
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date),
  };
};

const getClassSessionsPerWeek = (selectedClass: ClassGroup | null) =>
  selectedClass?.daysOfWeek?.length || selectedClass?.daysPerWeek || 0;

const getPlanSessionsPerWeek = (plan: ClassPlan, selectedClass: ClassGroup | null) =>
  plan.weeklySessions || getClassSessionsPerWeek(selectedClass);

const addMonthSummary = (
  byMonth: Map<string, MonthPlanningSummary>,
  month: ReturnType<typeof toMonthDescriptor>,
  lessonCount: number
) => {
  const existing = byMonth.get(month.monthKey);
  if (existing) {
    existing.weekCount += 1;
    existing.estimatedLessonCount += lessonCount;
    existing.hasPlans = true;
    return;
  }

  byMonth.set(month.monthKey, {
    monthKey: month.monthKey,
    label: month.label,
    year: month.year,
    month: month.month,
    weekCount: 1,
    estimatedLessonCount: lessonCount,
    hasPlans: true,
  });
};

const buildCycleMonthDescriptors = (activeCycle: PlanningCycle | null) => {
  const start = parseIsoDate(activeCycle?.startDate);
  const end = parseIsoDate(activeCycle?.endDate);
  if (!start || !end || start > end) return [];

  const months: ReturnType<typeof toMonthDescriptor>[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= limit && months.length < 24) {
    months.push(toMonthDescriptor(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

export function buildMonthPlanningSummaries(
  plans: ClassPlan[],
  selectedClass: ClassGroup | null,
  activeCycle: PlanningCycle | null,
  exceptions: ClassCalendarException[] = []
): MonthPlanningSummary[] {
  const byMonth = new Map<string, MonthPlanningSummary>();

  for (const plan of plans) {
    if (selectedClass) {
      const calendar = buildPlanSessionCalendar({
        plan,
        classGroup: selectedClass,
        exceptions,
      });
      const sessionsByMonth = new Map<string, { month: ReturnType<typeof toMonthDescriptor>; count: number }>();

      for (const session of calendar.sessions) {
        const sessionDate = parseIsoDate(session.date);
        if (!sessionDate) continue;
        const month = toMonthDescriptor(sessionDate);
        const existing = sessionsByMonth.get(month.monthKey);
        if (existing) {
          existing.count += 1;
        } else {
          sessionsByMonth.set(month.monthKey, { month, count: 1 });
        }
      }

      if (sessionsByMonth.size) {
        for (const entry of sessionsByMonth.values()) {
          addMonthSummary(byMonth, entry.month, entry.count);
        }
        continue;
      }
    }

    const date = parseIsoDate(plan.startDate);
    if (!date) {
      continue;
    }

    addMonthSummary(byMonth, toMonthDescriptor(date), getPlanSessionsPerWeek(plan, selectedClass));
  }

  const cycleMonths = buildCycleMonthDescriptors(activeCycle);
  for (const month of cycleMonths) {
    if (byMonth.has(month.monthKey)) continue;
    byMonth.set(month.monthKey, {
      monthKey: month.monthKey,
      label: month.label,
      year: month.year,
      month: month.month,
      weekCount: 0,
      estimatedLessonCount: 0,
      hasPlans: false,
    });
  }

  return [...byMonth.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}
