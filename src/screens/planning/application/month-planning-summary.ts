import type { ClassGroup, ClassPlan, PlanningCycle } from "../../../core/models";

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
  activeCycle: PlanningCycle | null
): MonthPlanningSummary[] {
  const byMonth = new Map<string, MonthPlanningSummary>();

  for (const plan of plans) {
    const date = parseIsoDate(plan.startDate);
    if (!date) continue;
    const month = toMonthDescriptor(date);
    const existing = byMonth.get(month.monthKey);
    const estimatedLessonCount = getPlanSessionsPerWeek(plan, selectedClass);

    if (existing) {
      existing.weekCount += 1;
      existing.estimatedLessonCount += estimatedLessonCount;
      existing.hasPlans = true;
      continue;
    }

    byMonth.set(month.monthKey, {
      monthKey: month.monthKey,
      label: month.label,
      year: month.year,
      month: month.month,
      weekCount: 1,
      estimatedLessonCount,
      hasPlans: true,
    });
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
