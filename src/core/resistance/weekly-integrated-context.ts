import type { WeeklyIntegratedTrainingContext } from "../models";

export const isWeeklyIntegratedTrainingContext = (
  value: unknown,
): value is WeeklyIntegratedTrainingContext =>
  typeof value === "object" &&
  value !== null &&
  "weeklyPhysicalEmphasis" in value &&
  "courtGymRelationship" in value &&
  "gymSessionsCount" in value &&
  "courtSessionsCount" in value &&
  "interferenceRisk" in value;

export const parseWeeklyIntegratedContext = (
  raw: string | undefined,
): WeeklyIntegratedTrainingContext | null => {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return isWeeklyIntegratedTrainingContext(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
