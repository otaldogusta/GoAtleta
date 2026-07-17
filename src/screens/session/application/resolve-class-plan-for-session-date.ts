import type { ClassPlan } from "../../../core/models";

const toTimestamp = (value: string | null | undefined) => {
  const timestamp = Date.parse(`${String(value ?? "").slice(0, 10)}T00:00:00`);
  return Number.isNaN(timestamp) ? null : timestamp;
};

export const resolveClassPlanForSessionDate = (
  plans: ClassPlan[],
  sessionDate: string
): ClassPlan | null => {
  const targetTimestamp = toTimestamp(sessionDate);
  if (!plans.length || targetTimestamp === null) return null;

  return [...plans]
    .filter((plan) => {
      const startTimestamp = toTimestamp(plan.startDate);
      return startTimestamp !== null && startTimestamp <= targetTimestamp;
    })
    .sort((left, right) => {
      const leftTimestamp = toTimestamp(left.startDate) ?? 0;
      const rightTimestamp = toTimestamp(right.startDate) ?? 0;
      if (leftTimestamp !== rightTimestamp) return rightTimestamp - leftTimestamp;
      return (right.weekNumber ?? 0) - (left.weekNumber ?? 0);
    })[0] ?? null;
};
