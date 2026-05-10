import type { ClassPlan } from "../../core/models";
import {
  buildWeekSessionPreview,
  type WeekSessionPreview,
} from "./application/build-week-session-preview";

type Segment = { label: string; length: number };

export type VisibleMonthWeekSlot = {
  key: string;
  sourceWeekNumber: number;
  monthKey: string;
  monthLabel: string;
  monthWeekNumber: number;
  sessionDates: WeekSessionPreview[];
  firstSessionDate: string | null;
  lastSessionDate: string | null;
};

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DAY_MS = 24 * 60 * 60 * 1000;

const parseIsoDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDays = (value: Date, days: number) => new Date(value.getTime() + days * DAY_MS);

const toIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveWeekStart = (planStart: Date | null, derivedStart: Date | null) => {
  if (planStart && derivedStart) {
    const diffInDays = Math.abs(planStart.getTime() - derivedStart.getTime()) / DAY_MS;
    return diffInDays <= 6 ? planStart : derivedStart;
  }

  return planStart ?? derivedStart;
};

const getMonthKey = (date: string) => {
  const [year, month] = date.split("-");
  return `${year}-${month}`;
};

const getMonthLabel = (monthKey: string) => {
  const [, month] = monthKey.split("-");
  return MONTHS_PT[Number(month) - 1] ?? "";
};

const buildSourceWeekSessions = (options: {
  weekNumber: number;
  cycleStartDate?: string | null;
  plansByWeek: Map<number, ClassPlan>;
  daysOfWeek?: number[];
  weeklySessions?: number | null;
}) => {
  const { weekNumber, cycleStartDate, plansByWeek, daysOfWeek, weeklySessions } = options;
  const baseStart = parseIsoDate(cycleStartDate);
  const planStart = parseIsoDate(plansByWeek.get(weekNumber)?.startDate);
  const derivedStart = baseStart ? addDays(baseStart, (weekNumber - 1) * 7) : null;
  const weekStart = resolveWeekStart(planStart, derivedStart);

  if (!weekStart) {
    return { weekStart: null, sessions: [] as WeekSessionPreview[] };
  }

  const sessions = buildWeekSessionPreview({
    startDate: toIsoDate(weekStart),
    daysOfWeek: daysOfWeek ?? [],
    weeklySessions: weeklySessions ?? daysOfWeek?.length ?? 0,
    minDate: cycleStartDate,
  });

  return { weekStart, sessions };
};

export const buildVisibleMonthWeekSlots = (options: {
  weekCount: number;
  cycleStartDate?: string | null;
  plans?: ClassPlan[];
  daysOfWeek?: number[];
  weeklySessions?: number | null;
}): VisibleMonthWeekSlot[] => {
  const { weekCount, cycleStartDate, plans = [], daysOfWeek, weeklySessions } = options;

  if (!weekCount) return [];

  const plansByWeek = new Map(plans.map((plan) => [plan.weekNumber, plan]));
  const rawSlots: Array<Omit<VisibleMonthWeekSlot, "monthWeekNumber">> = [];

  for (let weekNumber = 1; weekNumber <= weekCount; weekNumber += 1) {
    const { weekStart, sessions } = buildSourceWeekSessions({
      weekNumber,
      cycleStartDate,
      plansByWeek,
      daysOfWeek,
      weeklySessions,
    });

    if (sessions.length === 0) {
      if (!weekStart) continue;
      const fallbackMonthKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}`;
      rawSlots.push({
        key: `${fallbackMonthKey}-${weekNumber}`,
        sourceWeekNumber: weekNumber,
        monthKey: fallbackMonthKey,
        monthLabel: getMonthLabel(fallbackMonthKey),
        sessionDates: [],
        firstSessionDate: null,
        lastSessionDate: null,
      });
      continue;
    }

    const sessionsByMonth = new Map<string, WeekSessionPreview[]>();
    sessions.forEach((session) => {
      const monthKey = getMonthKey(session.date);
      const bucket = sessionsByMonth.get(monthKey) ?? [];
      bucket.push(session);
      sessionsByMonth.set(monthKey, bucket);
    });

    Array.from(sessionsByMonth.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([monthKey, monthSessions]) => {
        rawSlots.push({
          key: `${monthKey}-${weekNumber}`,
          sourceWeekNumber: weekNumber,
          monthKey,
          monthLabel: getMonthLabel(monthKey),
          sessionDates: monthSessions,
          firstSessionDate: monthSessions[0]?.date ?? null,
          lastSessionDate: monthSessions[monthSessions.length - 1]?.date ?? null,
        });
      });
  }

  const counters = new Map<string, number>();
  return rawSlots.map((slot) => {
    const nextNumber = (counters.get(slot.monthKey) ?? 0) + 1;
    counters.set(slot.monthKey, nextNumber);
    return {
      ...slot,
      monthWeekNumber: nextNumber,
    };
  });
};

const buildPrimarySlotBySourceWeek = (
  slots: VisibleMonthWeekSlot[],
  weekCount: number
) => {
  const byWeek = new Map<number, VisibleMonthWeekSlot>();

  slots.forEach((slot) => {
    if (byWeek.has(slot.sourceWeekNumber)) return;
    byWeek.set(slot.sourceWeekNumber, slot);
  });

  return Array.from({ length: weekCount }, (_, index) => byWeek.get(index + 1) ?? null);
};

export const buildWeekMonthKeys = (options: {
  weekCount: number;
  cycleStartDate?: string | null;
  plans?: ClassPlan[];
  daysOfWeek?: number[];
  weeklySessions?: number | null;
}): string[] => {
  const slots = buildVisibleMonthWeekSlots(options);
  return buildPrimarySlotBySourceWeek(slots, options.weekCount).map((slot) => slot?.monthKey ?? "");
};

export const buildMonthSegments = (options: {
  weekCount: number;
  cycleStartDate?: string | null;
  plans?: ClassPlan[];
  daysOfWeek?: number[];
  weeklySessions?: number | null;
}): Segment[] => {
  const slots = buildVisibleMonthWeekSlots(options);
  const segments: Segment[] = [];

  slots.forEach((slot) => {
    const last = segments[segments.length - 1];
    if (last?.label === slot.monthLabel) {
      last.length += 1;
    } else {
      segments.push({ label: slot.monthLabel, length: 1 });
    }
  });

  return segments;
};

export const buildMonthWeekNumbers = (options: {
  weekCount: number;
  cycleStartDate?: string | null;
  plans?: ClassPlan[];
  daysOfWeek?: number[];
  weeklySessions?: number | null;
}): number[] => {
  const slots = buildVisibleMonthWeekSlots(options);
  return buildPrimarySlotBySourceWeek(slots, options.weekCount).map((slot, index) => slot?.monthWeekNumber ?? index + 1);
};
