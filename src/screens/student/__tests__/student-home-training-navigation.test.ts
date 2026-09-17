import {
  resolveAdjacentDayIndex,
  resolveDayIndexAfterSwipe,
  resolveTrainingIndexForDate,
  toLocalDateKey,
} from "../student-home-training-navigation";

describe("student home training navigation", () => {
  it("moves between lessons with a bounded horizontal swipe", () => {
    expect(resolveDayIndexAfterSwipe({ currentIndex: 1, dragDistance: -48, velocityX: 0, total: 3 })).toBe(2);
    expect(resolveDayIndexAfterSwipe({ currentIndex: 1, dragDistance: 48, velocityX: 0, total: 3 })).toBe(0);
    expect(resolveDayIndexAfterSwipe({ currentIndex: 0, dragDistance: 60, velocityX: 0, total: 3 })).toBe(0);
  });

  it("moves one day at a time with keyboard-compatible bounds", () => {
    expect(resolveAdjacentDayIndex(4, 1, 7)).toBe(5);
    expect(resolveAdjacentDayIndex(4, -1, 7)).toBe(3);
    expect(resolveAdjacentDayIndex(0, -1, 7)).toBe(0);
    expect(resolveAdjacentDayIndex(6, 1, 7)).toBe(6);
  });

  it("selects the lesson attached to a tapped weekday", () => {
    const schedule = [
      { startsAt: new Date("2026-09-16T13:30:00") },
      { startsAt: new Date("2026-09-19T13:30:00") },
    ];
    expect(resolveTrainingIndexForDate(schedule, "2026-09-19")).toBe(1);
    expect(resolveTrainingIndexForDate(schedule, "2026-09-17")).toBe(-1);
  });

  it("uses the local calendar day instead of shifting through UTC", () => {
    const localDate = new Date(2026, 8, 19, 0, 30);
    expect(toLocalDateKey(localDate)).toBe("2026-09-19");
    expect(resolveTrainingIndexForDate([{ startsAt: localDate }], "2026-09-19")).toBe(0);
  });
});
