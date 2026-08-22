import type { PlanningCycle } from "../../../core/models";

const monthBounds = (monthKey: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return null;
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${monthKey}-01`,
    endDate: `${monthKey}-${String(lastDay).padStart(2, "0")}`,
  };
};

export const isMonthWithinPlanningCycle = (
  cycle: PlanningCycle | null | undefined,
  monthKey: string,
) => {
  const bounds = monthBounds(monthKey);
  if (!cycle || !bounds) return false;
  const cycleStart = String(cycle.startDate ?? "").slice(0, 10);
  const cycleEnd = String(cycle.endDate ?? "").slice(0, 10);
  return Boolean(
    cycleStart &&
      cycleEnd &&
      cycleStart <= bounds.endDate &&
      cycleEnd >= bounds.startDate,
  );
};

export const resolvePlanningCycleForMonth = (
  cycles: PlanningCycle[],
  activeCycle: PlanningCycle | null,
  monthKey: string,
) => {
  if (!monthBounds(monthKey)) return activeCycle;

  const matchingCycles = cycles.filter((cycle) =>
    isMonthWithinPlanningCycle(cycle, monthKey),
  );
  return (
    matchingCycles.find(
      (cycle) => cycle.id === activeCycle?.id && cycle.status === "active",
    ) ??
    matchingCycles.find((cycle) => cycle.status === "active") ??
    matchingCycles.sort((left, right) =>
      right.endDate.localeCompare(left.endDate),
    )[0] ??
    null
  );
};
