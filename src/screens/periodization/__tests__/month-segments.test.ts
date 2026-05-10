import type { ClassPlan } from "../../../core/models";
import {
  buildMonthSegments,
  buildMonthWeekNumbers,
  buildVisibleMonthWeekSlots,
  buildWeekMonthKeys,
} from "../month-segments";

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

describe("month segmentation for periodization", () => {
  it("duplicates a split week across adjacent months with local numbering", () => {
    const slots = buildVisibleMonthWeekSlots({
      weekCount: 6,
      cycleStartDate: "2026-06-02",
      plans: [makePlan(5, "2026-06-30"), makePlan(6, "2026-07-07")],
      daysOfWeek: [2, 4],
      weeklySessions: 2,
    });

    expect(slots.filter((slot) => slot.monthKey === "2026-06").map((slot) => ({
      week: slot.sourceWeekNumber,
      visible: slot.monthWeekNumber,
      first: slot.firstSessionDate,
      last: slot.lastSessionDate,
    }))).toEqual([
      { week: 1, visible: 1, first: "2026-06-02", last: "2026-06-04" },
      { week: 2, visible: 2, first: "2026-06-09", last: "2026-06-11" },
      { week: 3, visible: 3, first: "2026-06-16", last: "2026-06-18" },
      { week: 4, visible: 4, first: "2026-06-23", last: "2026-06-25" },
      { week: 5, visible: 5, first: "2026-06-30", last: "2026-06-30" },
    ]);

    expect(slots.filter((slot) => slot.monthKey === "2026-07").map((slot) => ({
      week: slot.sourceWeekNumber,
      visible: slot.monthWeekNumber,
      dates: slot.sessionDates.map((session) => session.date),
    }))).toEqual([
      { week: 5, visible: 1, dates: ["2026-07-02"] },
      { week: 6, visible: 2, dates: ["2026-07-07", "2026-07-09"] },
    ]);
  });

  it("builds month segments from visible month slots instead of dominant-week heuristics", () => {
    const segments = buildMonthSegments({
      weekCount: 6,
      cycleStartDate: "2026-06-02",
      plans: [makePlan(5, "2026-06-30"), makePlan(6, "2026-07-07")],
      daysOfWeek: [2, 4],
      weeklySessions: 2,
    });

    expect(segments).toEqual([
      { label: "Jun", length: 5 },
      { label: "Jul", length: 2 },
    ]);
  });

  it("keeps the source-week fallback aligned with the first visible slot of that week", () => {
    const weekMonthKeys = buildWeekMonthKeys({
      weekCount: 6,
      cycleStartDate: "2026-06-02",
      plans: [makePlan(5, "2026-06-30"), makePlan(6, "2026-07-07")],
      daysOfWeek: [2, 4],
      weeklySessions: 2,
    });

    const weekNumbers = buildMonthWeekNumbers({
      weekCount: 6,
      cycleStartDate: "2026-06-02",
      plans: [makePlan(5, "2026-06-30"), makePlan(6, "2026-07-07")],
      daysOfWeek: [2, 4],
      weeklySessions: 2,
    });

    expect(weekMonthKeys).toEqual([
      "2026-06",
      "2026-06",
      "2026-06",
      "2026-06",
      "2026-06",
      "2026-07",
    ]);
    expect(weekNumbers).toEqual([1, 2, 3, 4, 5, 2]);
  });

  it("uses derived week dates when saved plan dates are stale", () => {
    const slots = buildVisibleMonthWeekSlots({
      weekCount: 3,
      cycleStartDate: "2026-05-05",
      plans: [
        makePlan(1, "2026-05-05"),
        makePlan(2, "2026-05-05"),
        makePlan(3, "2026-05-05"),
      ],
      daysOfWeek: [2, 4],
      weeklySessions: 2,
    });

    expect(slots.map((slot) => slot.sessionDates.map((session) => session.date))).toEqual([
      ["2026-05-05", "2026-05-07"],
      ["2026-05-12", "2026-05-14"],
      ["2026-05-19", "2026-05-21"],
    ]);
  });
});
