import type { OrgClass } from "../../../api/members";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const formatClock = (value: string | null | undefined) => {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

export const formatClassAssignmentMeta = (
  classGroup: Pick<OrgClass, "unit" | "daysOfWeek" | "startTime" | "endTime">
) => {
  const uniqueDays = new Set(
    (classGroup.daysOfWeek ?? []).filter(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6
    )
  );
  const daysLabel = DAY_ORDER.filter((day) => uniqueDays.has(day))
    .map((day) => DAY_LABELS[day])
    .join(", ");
  const startTime = formatClock(classGroup.startTime);
  const endTime = formatClock(classGroup.endTime);
  const timeLabel = startTime && endTime ? `${startTime}–${endTime}` : startTime || endTime;

  return [classGroup.unit.trim(), daysLabel, timeLabel].filter(Boolean).join(" · ");
};
