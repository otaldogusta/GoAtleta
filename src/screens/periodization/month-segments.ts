import type { ClassPlan } from "../../core/models";

type Segment = { label: string; length: number };

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DAY_MS = 24 * 60 * 60 * 1000;

const parseIsoDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDays = (value: Date, days: number) => new Date(value.getTime() + days * DAY_MS);

const getWeekAnchorDate = (start: Date) => addDays(start, 3);

export const buildMonthSegments = (options: {
  weekCount: number;
  cycleStartDate?: string | null;
  plans?: ClassPlan[];
}): Segment[] => {
  const { weekCount, cycleStartDate, plans = [] } = options;

  if (!weekCount) return [];

  const plansByWeek = new Map(plans.map((plan) => [plan.weekNumber, plan]));
  const baseStart = parseIsoDate(cycleStartDate);
  const segments: Segment[] = [];

  for (let weekNumber = 1; weekNumber <= weekCount; weekNumber += 1) {
    const planStart = parseIsoDate(plansByWeek.get(weekNumber)?.startDate);
    const derivedStart = baseStart ? addDays(baseStart, (weekNumber - 1) * 7) : null;
    const weekStart = derivedStart ?? planStart;

    if (!weekStart) {
      return [{ label: "Ciclo", length: weekCount }];
    }

    const label = MONTHS_PT[getWeekAnchorDate(weekStart).getMonth()];
    const last = segments[segments.length - 1];

    if (last?.label === label) {
      last.length += 1;
    } else {
      segments.push({ label, length: 1 });
    }
  }

  return segments;
};

export const buildMonthWeekNumbers = (options: {
  weekCount: number;
  cycleStartDate?: string | null;
  plans?: ClassPlan[];
}): number[] => {
  const { weekCount, cycleStartDate, plans = [] } = options;

  if (!weekCount) return [];

  const plansByWeek = new Map(plans.map((plan) => [plan.weekNumber, plan]));
  const baseStart = parseIsoDate(cycleStartDate);
  const result: number[] = [];
  let lastLabel = "";
  let weekInMonth = 0;

  for (let weekNumber = 1; weekNumber <= weekCount; weekNumber += 1) {
    const planStart = parseIsoDate(plansByWeek.get(weekNumber)?.startDate);
    const derivedStart = baseStart ? addDays(baseStart, (weekNumber - 1) * 7) : null;
    const weekStart = derivedStart ?? planStart;

    if (!weekStart) {
      return Array.from({ length: weekCount }, (_, index) => index + 1);
    }

    const label = MONTHS_PT[getWeekAnchorDate(weekStart).getMonth()];

    if (label === lastLabel) {
      weekInMonth += 1;
    } else {
      lastLabel = label;
      weekInMonth = 1;
    }

    result.push(weekInMonth);
  }

  return result;
};
