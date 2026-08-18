import type { PlanningCycle } from "../../../core/models";

type CycleWindow = Pick<PlanningCycle, "endDate" | "status" | "year">;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoDate = (value: string) => {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatIsoDate = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

/**
 * A new cycle may inherit pedagogical and load parameters, but it must have a
 * new temporal identity. The first safe suggestion is the day after the most
 * recent archived cycle; when that would reuse its year, the next full year is
 * suggested to respect the one-cycle-per-class/year persistence contract.
 */
export const resolveNextCycleStartDate = (
  cycles: CycleWindow[],
  fallbackStartDate: string,
) => {
  const archived = cycles
    .filter((cycle) => cycle.status === "archived")
    .sort((left, right) => {
      const dateOrder = right.endDate.localeCompare(left.endDate);
      return dateOrder || right.year - left.year;
    });
  const latest = archived[0];

  if (!latest) return fallbackStartDate;

  const endDate = parseIsoDate(latest.endDate);
  if (endDate) {
    endDate.setDate(endDate.getDate() + 1);
    if (endDate.getFullYear() > latest.year) return formatIsoDate(endDate);
  }

  return `${latest.year + 1}-01-01`;
};

export const buildNextCycleDraft = <T extends { cycleStartDate: string }>(
  baseDraft: T,
  cycles: CycleWindow[],
): T => ({
  ...baseDraft,
  cycleStartDate: resolveNextCycleStartDate(cycles, baseDraft.cycleStartDate),
});
