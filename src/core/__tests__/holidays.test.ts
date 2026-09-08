import { brazilDateKey, nationalHoliday } from "../holidays";
import { filterActionablePendingAttendance } from "../pending-attendance";

it("uses the Brazilian day at the UTC date boundary", () => {
  expect(brazilDateKey(new Date("2026-09-08T01:00:00Z"))).toBe("2026-09-07");
  expect(nationalHoliday("2026-09-07")).toBe("Independência do Brasil");
  expect(nationalHoliday("2026-09-08")).toBeNull();
  expect(nationalHoliday("2026-02-17")).toBeNull();
});
it("exempts only the suspended class and date, including past pending dates", () => {
  const candidates = [{ classId: "a", targetDate: "2026-09-07" }, { classId: "b", targetDate: "2026-09-07" }, { classId: "a", targetDate: "2026-09-06" }];
  expect(filterActionablePendingAttendance({ candidates, schedules: [], now: new Date(2026, 8, 8), pauses: [{ class_id: "a", date: "2026-09-07" }] })).toEqual(candidates.slice(1));
});
