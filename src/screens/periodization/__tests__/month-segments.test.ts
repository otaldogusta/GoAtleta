import type { ClassPlan } from "../../../core/models";
import { buildMonthSegments, buildMonthWeekNumbers } from "../month-segments";

const makePlan = (weekNumber: number, startDate: string): ClassPlan => ({
  id: `plan-${weekNumber}`,
  classId: "class-1",
  startDate,
  weekNumber,
  phase: "Base",
  theme: "Controle de bola",
  technicalFocus: "Passe",
  physicalFocus: "Base",
  constraints: "",
  mvFormat: "6x6",
  warmupProfile: "Ativacao",
  jumpTarget: "20",
  rpeTarget: "4-5",
  source: "AUTO",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("buildMonthSegments", () => {
  it("moves a week into the next month when most of the week is already there", () => {
    const segments = buildMonthSegments({
      weekCount: 4,
      cycleStartDate: "2026-03-10",
    });

    expect(segments).toEqual([
      { label: "Mar", length: 3 },
      { label: "Abr", length: 1 },
    ]);
  });

  it("prefers explicit saved week dates when they exist", () => {
    const segments = buildMonthSegments({
      weekCount: 4,
      cycleStartDate: "2026-03-01",
      plans: [
        makePlan(1, "2026-03-03"),
        makePlan(2, "2026-03-10"),
        makePlan(3, "2026-03-31"),
        makePlan(4, "2026-04-07"),
      ],
    });

    expect(segments).toEqual([
      { label: "Mar", length: 2 },
      { label: "Abr", length: 2 },
    ]);
  });

  it("resets the displayed week number when the month changes", () => {
    const weekNumbers = buildMonthWeekNumbers({
      weekCount: 8,
      cycleStartDate: "2026-04-01",
    });

    expect(weekNumbers).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });

  it("uses saved week dates to calculate the week number within the month", () => {
    const weekNumbers = buildMonthWeekNumbers({
      weekCount: 6,
      cycleStartDate: "2026-03-01",
      plans: [
        makePlan(1, "2026-03-03"),
        makePlan(2, "2026-03-10"),
        makePlan(3, "2026-03-17"),
        makePlan(4, "2026-04-01"),
        makePlan(5, "2026-04-08"),
        makePlan(6, "2026-04-15"),
      ],
    });

    expect(weekNumbers).toEqual([1, 2, 3, 1, 2, 3]);
  });
});
