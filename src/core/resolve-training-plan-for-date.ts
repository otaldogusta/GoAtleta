import type { TrainingPlan } from "./models";

/** Calendar dates have no timezone. Return Monday=1 through Sunday=7. */
export function trainingPlanWeekday(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return parsed.getUTCDay() || 7;
}

/** Shared by the lesson screen and attendance/report synchronization. */
export function resolveTrainingPlanForDate(
  plans: TrainingPlan[],
  classId: string,
  date: string,
  weekdayId?: number,
): TrainingPlan | null {
  const civilWeekday = trainingPlanWeekday(date);
  if (civilWeekday === null) return null;
  const weekday = weekdayId === 0 ? 7 : weekdayId ?? civilWeekday;
  const relevant = plans.filter((plan) =>
    plan.classId === classId && (!plan.status || plan.status === "final"),
  );
  const latest = (candidates: TrainingPlan[]) => [...candidates].sort((left, right) =>
    (right.version ?? 0) - (left.version ?? 0) || right.createdAt.localeCompare(left.createdAt),
  )[0] ?? null;
  return latest(relevant.filter((plan) => plan.applyDate === date)) ?? latest(
    relevant.filter((plan) => !plan.applyDate && (plan.applyDays ?? []).includes(weekday)),
  );
}
