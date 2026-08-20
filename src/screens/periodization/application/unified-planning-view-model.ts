import type {
  ClassCalendarException,
  ClassGroup,
  ClassPlan,
} from "../../../core/models";
import type { MonthPlanningSummary } from "../../planning/application/month-planning-summary";
import { filterClassPlansBySessionMonth } from "../../planning/application/monthly-plan-calendar";

export type MonthCyclePresentation = {
  monthKey: string;
  phase: string;
  planningStatus: "planned" | "pending" | "unplanned";
  weekNumbers: number[];
  weekRangeLabel: string;
  loadValues: number[];
  loadRangeLabel: string;
};

export const UNIFIED_PLANNING_HORIZONTAL_CONTEXT_MIN_WIDTH = 680;

export const resolveUnifiedPlanningContextLayout = (containerWidth: number) => ({
  horizontalContext:
    Number.isFinite(containerWidth) &&
    containerWidth >= UNIFIED_PLANNING_HORIZONTAL_CONTEXT_MIN_WIDTH,
});

const uniqueSortedNumbers = (values: number[]) =>
  [...new Set(values.filter(Number.isFinite))].sort((a, b) => a - b);

export const parsePseMidpoint = (value: string | null | undefined) => {
  const matches = String(value ?? "").match(/\d+(?:[.,]\d+)?/g) ?? [];
  const values = matches
    .map((item) => Number(item.replace(",", ".")))
    .filter(Number.isFinite);
  if (!values.length) return null;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
};

const resolveDominantPhase = (plans: ClassPlan[]) => {
  const counts = new Map<string, number>();
  for (const plan of plans) {
    const phase = String(plan.phase ?? "").trim();
    if (phase) counts.set(phase, (counts.get(phase) ?? 0) + 1);
  }
  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Sem semanas geradas"
  );
};

const formatWeekRange = (weekNumbers: number[]) => {
  if (!weekNumbers.length) return "—";
  if (weekNumbers.length === 1) return String(weekNumbers[0]);
  return `${weekNumbers[0]}–${weekNumbers[weekNumbers.length - 1]}`;
};

const formatLoadRange = (values: number[]) => {
  if (!values.length) return "Carga não gerada";
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const format = (value: number) =>
    Number.isInteger(value)
      ? String(value)
      : value.toFixed(1).replace(".", ",");
  return minimum === maximum
    ? `PSE ${format(minimum)}`
    : `PSE ${format(minimum)}–${format(maximum)}`;
};

export function buildMonthCyclePresentations(params: {
  summaries: MonthPlanningSummary[];
  classPlans: ClassPlan[];
  selectedClass: ClassGroup | null;
  calendarExceptions: ClassCalendarException[];
}) {
  return new Map(
    params.summaries.map((summary) => {
      const plans = filterClassPlansBySessionMonth(
        params.classPlans,
        params.selectedClass,
        params.calendarExceptions,
        summary.monthKey,
      ).sort((a, b) => a.weekNumber - b.weekNumber);
      const weekNumbers = uniqueSortedNumbers(
        plans.map((plan) => plan.weekNumber),
      );
      const loadValues = plans
        .map((plan) => parsePseMidpoint(plan.rpeTarget))
        .filter((value): value is number => value !== null);
      const planningStatus = !plans.length
        ? "unplanned"
        : plans.some(
            (plan) =>
              plan.syncStatus === "out_of_sync" ||
              plan.syncStatus === "stale_parent",
          )
          ? "pending"
          : "planned";

      return [
        summary.monthKey,
        {
          monthKey: summary.monthKey,
          phase: resolveDominantPhase(plans),
          planningStatus,
          weekNumbers,
          weekRangeLabel: formatWeekRange(weekNumbers),
          loadValues,
          loadRangeLabel: formatLoadRange(loadValues),
        } satisfies MonthCyclePresentation,
      ] as const;
    }),
  );
}

export const monthNeedsRegeneration = (
  plans: ClassPlan[],
  hasAgendaEvents: boolean,
) =>
  !hasAgendaEvents ||
  plans.some(
    (plan) =>
      plan.syncStatus === "out_of_sync" || plan.syncStatus === "stale_parent",
  );

export function resolveDefaultSelectedAgendaEvent<
  T extends { id: string; date?: string | null }
>(
  events: T[],
  currentSelectedId?: string | null,
  referenceDateIso?: string,
): T | null {
  if (!events.length) return null;
  if (currentSelectedId) {
    const persisted = events.find((event) => event.id === currentSelectedId);
    if (persisted) return persisted;
  }
  const today =
    referenceDateIso ?? new Date().toISOString().slice(0, 10);
  const upcomingOrToday = events.find(
    (event) => typeof event.date === "string" && event.date >= today,
  );
  if (upcomingOrToday) return upcomingOrToday;
  return events[events.length - 1] ?? events[0];
}
