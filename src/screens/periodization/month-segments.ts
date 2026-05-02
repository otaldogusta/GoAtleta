import type { ClassPlan } from "../../core/models";
import { buildWeekSessionPreview } from "./application/build-week-session-preview";

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

const toIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekMonthLabel = (
  weekStart: Date,
  options: { daysOfWeek?: number[]; weeklySessions?: number | null }
) => {
  const daysOfWeek = options.daysOfWeek ?? [];
  const weeklySessions = options.weeklySessions ?? daysOfWeek.length;

  if (daysOfWeek.length > 0 && weeklySessions > 0) {
    const sessions = buildWeekSessionPreview({
      startDate: toIsoDate(weekStart),
      daysOfWeek,
      weeklySessions,
    });
    const firstSessionDate = parseIsoDate(sessions[0]?.date);
    if (firstSessionDate) {
      return MONTHS_PT[firstSessionDate.getMonth()];
    }
  }

  return MONTHS_PT[getWeekAnchorDate(weekStart).getMonth()];
};

export const buildMonthSegments = (options: {
  weekCount: number;
  cycleStartDate?: string | null;
  plans?: ClassPlan[];
  daysOfWeek?: number[];
  weeklySessions?: number | null;
}): Segment[] => {
  const { weekCount, cycleStartDate, plans = [], daysOfWeek, weeklySessions } = options;

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

    const label = getWeekMonthLabel(weekStart, { daysOfWeek, weeklySessions });
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
  daysOfWeek?: number[];
  weeklySessions?: number | null;
}): number[] => {
  const { weekCount, cycleStartDate, plans = [], daysOfWeek, weeklySessions } = options;

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

    const label = getWeekMonthLabel(weekStart, { daysOfWeek, weeklySessions });

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
