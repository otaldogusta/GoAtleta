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

  it("uses the cycle start as the source of truth when it exists", () => {
    const segments = buildMonthSegments({
      weekCount: 4,
      cycleStartDate: "2026-03-01",
      plans: [
        makePlan(1, "2026-03-03"),
        makePlan(2, "2026-03-03"),
        makePlan(3, "2026-03-03"),
        makePlan(4, "2026-03-03"),
      ],
    });

    expect(segments).toEqual([
      { label: "Mar", length: 4 },
    ]);
  });

  it("resets the displayed week number when the month changes", () => {
    const weekNumbers = buildMonthWeekNumbers({
      weekCount: 8,
      cycleStartDate: "2026-04-01",
    });

    expect(weekNumbers).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });

  it("keeps week numbers aligned to the cycle even when saved dates are stale", () => {
    const weekNumbers = buildMonthWeekNumbers({
      weekCount: 6,
      cycleStartDate: "2026-03-01",
      plans: [
        makePlan(1, "2026-03-03"),
        makePlan(2, "2026-03-03"),
        makePlan(3, "2026-03-03"),
        makePlan(4, "2026-03-03"),
        makePlan(5, "2026-03-03"),
        makePlan(6, "2026-03-03"),
      ],
    });

    expect(weekNumbers).toEqual([1, 2, 3, 4, 1, 2]);
  });

  it("falls back to saved week dates when the cycle start is missing", () => {
    const segments = buildMonthSegments({
      weekCount: 4,
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

  it("never renders more than 5 visible weeks inside the same month", () => {
    const cycleStartDates = [
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
      "2026-12-01",
    ];

    cycleStartDates.forEach((cycleStartDate) => {
      const segments = buildMonthSegments({
        weekCount: 53,
        cycleStartDate,
      });

      const weekNumbers = buildMonthWeekNumbers({
        weekCount: 53,
        cycleStartDate,
      });

      segments.forEach((segment) => {
        expect(segment.length).toBeLessThanOrEqual(5);
      });

      expect(Math.max(...weekNumbers)).toBeLessThanOrEqual(5);
    });
  });

  it("keeps the 5-week cap across broad cycle start/date combinations", () => {
    const weekCounts = [12, 24, 52] as const;
    const start = new Date(2025, 0, 1);
    const end = new Date(2027, 11, 31);

    const toIso = (value: Date) => {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 5)) {
      const cycleStartDate = toIso(cursor);

      weekCounts.forEach((weekCount) => {
        const segments = buildMonthSegments({
          weekCount,
          cycleStartDate,
        });

        const weekNumbers = buildMonthWeekNumbers({
          weekCount,
          cycleStartDate,
        });

        segments.forEach((segment) => {
          expect(segment.length).toBeLessThanOrEqual(5);
        });

        expect(Math.max(...weekNumbers)).toBeLessThanOrEqual(5);
      });
    }
  });
});
