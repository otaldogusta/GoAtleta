import type { OrgClass } from "../../../api/members";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const collator = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

const formatClock = (value: string | null | undefined) => {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

export const getClassAssignmentScheduleLabels = (
  classGroup: Pick<OrgClass, "daysOfWeek" | "startTime" | "endTime">
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

  return {
    daysLabel: daysLabel || "Dias não informados",
    timeLabel: timeLabel || "Horário não informado",
  };
};

export const formatClassAssignmentMeta = (
  classGroup: Pick<OrgClass, "unit" | "daysOfWeek" | "startTime" | "endTime">
) => {
  const { daysLabel, timeLabel } = getClassAssignmentScheduleLabels(classGroup);
  return [
    classGroup.unit.trim(),
    daysLabel === "Dias não informados" ? "" : daysLabel,
    timeLabel === "Horário não informado" ? "" : timeLabel,
  ]
    .filter(Boolean)
    .join(" · ");
};

const getFirstWeekdayOrder = (daysOfWeek: number[] | undefined) =>
  Math.min(
    ...(daysOfWeek ?? [])
      .map((day) => DAY_ORDER.indexOf(day as (typeof DAY_ORDER)[number]))
      .filter((dayIndex) => dayIndex >= 0),
    DAY_ORDER.length
  );

const getStartTimeMinutes = (value: string | undefined) => {
  const clock = formatClock(value);
  if (!clock) return Number.POSITIVE_INFINITY;
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
};

export type ClassAssignmentGroup = {
  unit: string;
  classes: OrgClass[];
};

export const groupClassAssignments = (classes: OrgClass[]): ClassAssignmentGroup[] => {
  const groups = new Map<string, OrgClass[]>();

  classes.forEach((classGroup) => {
    const unit = classGroup.unit.trim() || "Sem unidade";
    const current = groups.get(unit) ?? [];
    current.push(classGroup);
    groups.set(unit, current);
  });

  return [...groups.entries()]
    .sort(([leftUnit], [rightUnit]) => collator.compare(leftUnit, rightUnit))
    .map(([unit, unitClasses]) => ({
      unit,
      classes: [...unitClasses].sort((left, right) => {
        const weekdayDifference =
          getFirstWeekdayOrder(left.daysOfWeek) - getFirstWeekdayOrder(right.daysOfWeek);
        if (weekdayDifference !== 0) return weekdayDifference;

        const timeDifference =
          getStartTimeMinutes(left.startTime) - getStartTimeMinutes(right.startTime);
        if (timeDifference !== 0) return timeDifference;

        return collator.compare(left.name, right.name);
      }),
    }));
};
