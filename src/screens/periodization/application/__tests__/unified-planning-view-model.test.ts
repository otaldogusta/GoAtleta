import type { ClassGroup, ClassPlan } from "../../../../core/models";
import type { MonthPlanningSummary } from "../../../planning/application/month-planning-summary";
import {
  buildMonthCyclePresentations,
  monthNeedsRegeneration,
  parsePseMidpoint,
  resolveUnifiedPlanningContextLayout,
} from "../unified-planning-view-model";

const selectedClass = {
  id: "class-1",
  daysOfWeek: [3, 5],
  daysPerWeek: 2,
} as ClassGroup;

const plan = (
  weekNumber: number,
  startDate: string,
  phase: string,
  rpeTarget: string,
): ClassPlan => ({
  id: `plan-${weekNumber}`,
  classId: "class-1",
  startDate,
  weekNumber,
  phase,
  theme: "Passe",
  technicalFocus: "Passe",
  physicalFocus: "Coordenação",
  constraints: "",
  mvFormat: "",
  warmupProfile: "",
  jumpTarget: "",
  rpeTarget,
  source: "AUTO",
  createdAt: startDate,
  updatedAt: startDate,
});

const summary: MonthPlanningSummary = {
  monthKey: "2026-07",
  label: "julho de 2026",
  year: 2026,
  month: 7,
  weekCount: 2,
  estimatedLessonCount: 4,
  hasPlans: true,
};

describe("unified planning view model", () => {
  it("uses the horizontal month context only when the container can hold it", () => {
    expect(resolveUnifiedPlanningContextLayout(679).horizontalContext).toBe(false);
    expect(resolveUnifiedPlanningContextLayout(680).horizontalContext).toBe(true);
    expect(resolveUnifiedPlanningContextLayout(Number.NaN).horizontalContext).toBe(false);
  });

  it("uses actual cycle weeks and load targets for the month", () => {
    const presentations = buildMonthCyclePresentations({
      summaries: [summary],
      classPlans: [
        plan(27, "2026-07-01", "Jogos reduzidos", "PSE 4-5"),
        plan(28, "2026-07-08", "Jogos reduzidos", "PSE 6"),
      ],
      selectedClass,
      calendarExceptions: [],
    });

    expect(presentations.get("2026-07")).toMatchObject({
      phase: "Jogos reduzidos",
      planningStatus: "planned",
      weekNumbers: [27, 28],
      weekRangeLabel: "27–28",
      loadValues: [4.5, 6],
      loadRangeLabel: "PSE 4,5–6",
    });
  });

  it("does not invent a curve or week range for empty months", () => {
    const presentations = buildMonthCyclePresentations({
      summaries: [
        { ...summary, monthKey: "2026-08", month: 8, hasPlans: false },
      ],
      classPlans: [],
      selectedClass,
      calendarExceptions: [],
    });

    expect(presentations.get("2026-08")).toMatchObject({
      phase: "Sem semanas geradas",
      planningStatus: "unplanned",
      weekRangeLabel: "—",
      loadValues: [],
      loadRangeLabel: "Carga não gerada",
    });
  });

  it("marks a month as pending when a weekly plan is out of sync", () => {
    const presentations = buildMonthCyclePresentations({
      summaries: [summary],
      classPlans: [
        {
          ...plan(27, "2026-07-01", "Jogos reduzidos", "PSE 5-6"),
          syncStatus: "out_of_sync",
        },
      ],
      selectedClass,
      calendarExceptions: [],
    });

    expect(presentations.get("2026-07")?.planningStatus).toBe("pending");
  });

  it("parses ranges and only requests regeneration for missing or stale plans", () => {
    expect(parsePseMidpoint("PSE 3–6")).toBe(4.5);
    expect(parsePseMidpoint("")).toBeNull();
    expect(monthNeedsRegeneration([], false)).toBe(true);
    expect(
      monthNeedsRegeneration(
        [{ ...plan(1, "2026-07-01", "Base", "4"), syncStatus: "in_sync" }],
        true,
      ),
    ).toBe(false);
    expect(
      monthNeedsRegeneration(
        [{ ...plan(1, "2026-07-01", "Base", "4"), syncStatus: "stale_parent" }],
        true,
      ),
    ).toBe(true);
  });
});
