import type { ClassGroup } from "../../../core/models";
import { normalizeUnitKey } from "../../../core/unit-key";

type ScheduledClass = Pick<
  ClassGroup,
  "unit" | "trainingSpace" | "startTime" | "durationMinutes" | "daysOfWeek"
>;

const toMinutes = (value: string) => {
  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export const trainingSpacesMayOverlap = (
  left: string | null | undefined,
  right: string | null | undefined
) => {
  const leftKey = normalizeUnitKey(left ?? "");
  const rightKey = normalizeUnitKey(right ?? "");

  // Missing space data is treated conservatively so legacy classes do not
  // silently lose real conflict warnings before being configured.
  if (!leftKey || !rightKey) return true;
  return leftKey === rightKey;
};

export const getClassScheduleOverlapDays = (
  left: ScheduledClass,
  right: ScheduledClass
) => {
  if (normalizeUnitKey(left.unit) !== normalizeUnitKey(right.unit)) return [];
  if (!trainingSpacesMayOverlap(left.trainingSpace, right.trainingSpace)) return [];

  const leftStart = toMinutes(left.startTime ?? "");
  const rightStart = toMinutes(right.startTime ?? "");
  if (leftStart === null || rightStart === null) return [];

  const leftEnd = leftStart + (left.durationMinutes || 60);
  const rightEnd = rightStart + (right.durationMinutes || 60);
  if (!(leftStart < rightEnd && rightStart < leftEnd)) return [];

  const rightDays = new Set(right.daysOfWeek ?? []);
  return (left.daysOfWeek ?? []).filter((day) => rightDays.has(day));
};
