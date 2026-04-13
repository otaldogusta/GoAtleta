import {
    resolveOrderedTrainingDays,
    resolveSessionIndexInWeek,
} from "../cycle-day-planning/resolve-session-index-in-week";

describe("resolveSessionIndexInWeek", () => {
  it("sorts and normalizes training days before resolving the session position", () => {
    expect(resolveOrderedTrainingDays([6, 2, 4])).toEqual([2, 4, 6]);
    expect(resolveOrderedTrainingDays([0, 2])).toEqual([2, 7]);
  });

  it("returns the exact session order when the session date matches a training day", () => {
    expect(
      resolveSessionIndexInWeek({
        daysOfWeek: [2, 4, 6],
        sessionDate: "2026-04-07",
      })
    ).toBe(1);
    expect(
      resolveSessionIndexInWeek({
        daysOfWeek: [2, 4, 6],
        sessionDate: "2026-04-09",
      })
    ).toBe(2);
    expect(
      resolveSessionIndexInWeek({
        daysOfWeek: [2, 4, 6],
        sessionDate: "2026-04-11",
      })
    ).toBe(3);
  });

  it("falls back to the nearest previous training slot when the date is not an exact match", () => {
    expect(
      resolveSessionIndexInWeek({
        daysOfWeek: [2, 4, 6],
        sessionDate: "2026-04-10",
      })
    ).toBe(2);
  });

  it("defaults to the first session when there are no valid training days", () => {
    expect(
      resolveSessionIndexInWeek({
        daysOfWeek: [],
        sessionDate: "2026-04-10",
      })
    ).toBe(1);
  });
});
