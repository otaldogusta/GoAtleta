import type { ClassCalendarException, ClassGroup, ClassPlan } from "../../../core/models";
import { buildSessionCalendar, type PlannedSession } from "../../../core/session-calendar-engine";

type MonthWindow = {
  startDate: string;
  endDate: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const resolveMonthWindow = (monthKey: string): MonthWindow | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
};

const isWithinWindow = (date: string, window: MonthWindow | null) =>
  Boolean(window && date >= window.startDate && date <= window.endDate);

const resolvePlanWeekEndDate = (plan: Pick<ClassPlan, "startDate">) => {
  const start = parseIsoDate(plan.startDate);
  if (!start) return "";
  return toIsoDate(new Date(start.getTime() + 6 * DAY_MS));
};

const parsePlanDaysOfWeek = (plan: Pick<ClassPlan, "daysOfWeek">, classGroup: ClassGroup) => {
  if (!plan.daysOfWeek) return classGroup.daysOfWeek ?? [];
  try {
    const parsed = JSON.parse(plan.daysOfWeek);
    if (!Array.isArray(parsed)) return classGroup.daysOfWeek ?? [];
    return parsed
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  } catch {
    return classGroup.daysOfWeek ?? [];
  }
};

const resolveTrainingWeekStartDate = (plan: Pick<ClassPlan, "daysOfWeek" | "startDate">, classGroup: ClassGroup) => {
  const start = parseIsoDate(plan.startDate);
  if (!start) return "";

  const daysOfWeek = parsePlanDaysOfWeek(plan, classGroup);
  if (!daysOfWeek.length) return plan.startDate;

  const firstTrainingDay = Math.min(...daysOfWeek);
  const weekStart = new Date(start);
  weekStart.setDate(start.getDate() - start.getDay() + firstTrainingDay);
  return toIsoDate(weekStart);
};

const resolveTrainingWeekEndDate = (plan: Pick<ClassPlan, "daysOfWeek" | "startDate">, classGroup: ClassGroup) => {
  const start = parseIsoDate(resolveTrainingWeekStartDate(plan, classGroup));
  if (!start) return resolvePlanWeekEndDate(plan);
  return toIsoDate(new Date(start.getTime() + 6 * DAY_MS));
};

export const buildPlanSessionCalendar = (params: {
  plan: ClassPlan;
  classGroup: ClassGroup;
  exceptions?: ClassCalendarException[];
  monthKey?: string;
}) => {
  const { plan, classGroup, exceptions, monthKey } = params;
  const monthWindow = monthKey ? resolveMonthWindow(monthKey) : null;
  const calendar = buildSessionCalendar({
    classGroup: {
      ...classGroup,
      daysOfWeek: parsePlanDaysOfWeek(plan, classGroup),
      daysPerWeek: plan.weeklySessions || classGroup.daysPerWeek,
    },
    startDate: resolveTrainingWeekStartDate(plan, classGroup),
    endDate: resolveTrainingWeekEndDate(plan, classGroup),
    exceptions,
  });

  if (!monthWindow) return calendar;

  return {
    ...calendar,
    sessions: calendar.sessions.filter((session) => isWithinWindow(session.date, monthWindow)),
    skippedSessions: calendar.skippedSessions.filter((session) => isWithinWindow(session.date, monthWindow)),
    allSessions: calendar.allSessions.filter((session) => isWithinWindow(session.date, monthWindow)),
  };
};

export const filterClassPlansBySessionMonth = (
  plans: ClassPlan[],
  classGroup: ClassGroup | null,
  exceptions: ClassCalendarException[],
  monthKey: string
) => {
  const monthWindow = resolveMonthWindow(monthKey);
  if (!classGroup || !monthWindow) {
    return plans.filter((plan) => plan.startDate?.startsWith(`${monthKey}-`));
  }

  return plans.filter((plan) => {
    const calendar = buildPlanSessionCalendar({
      plan,
      classGroup,
      exceptions,
      monthKey,
    });
    return calendar.allSessions.some((session: PlannedSession) => isWithinWindow(session.date, monthWindow));
  });
};
