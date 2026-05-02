import type { ClassGroup, ClassPlan } from "../../../core/models";
import {
  buildWeekSessionPreview,
  type WeekSessionPreview,
} from "../../periodization/application/build-week-session-preview";

export const toMonthKey = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const buildPlanSessions = (plan: ClassPlan, selectedClass: ClassGroup | null): WeekSessionPreview[] => {
  const daysOfWeek = selectedClass?.daysOfWeek ?? [];
  const weeklySessions = selectedClass?.daysPerWeek || daysOfWeek.length;

  return buildWeekSessionPreview({
    startDate: plan.startDate,
    daysOfWeek,
    weeklySessions,
  });
};

export const planHasSessionInMonth = (plan: ClassPlan, selectedClass: ClassGroup | null, monthKey: string) => {
  const sessions = buildPlanSessions(plan, selectedClass);
  if (sessions.length > 0) {
    return sessions.some((session) => toMonthKey(session.date) === monthKey);
  }
  return toMonthKey(plan.startDate) === monthKey;
};

export const filterPlansWithSessionsInMonth = (
  plans: ClassPlan[],
  selectedClass: ClassGroup | null,
  monthKey: string
) => plans.filter((plan) => planHasSessionInMonth(plan, selectedClass, monthKey));

export const filterSessionsInMonth = (sessions: WeekSessionPreview[], monthKey: string) =>
  sessions.filter((session) => toMonthKey(session.date) === monthKey);
