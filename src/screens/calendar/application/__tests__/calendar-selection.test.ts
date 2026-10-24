import { selectCalendarDay, foldCalendarAfterDrag } from "../calendar-selection";
const days = [
  { dateIso: "2026-09-30", isCurrentMonth: false, isToday: false },
  { dateIso: "2026-10-01", isCurrentMonth: true, isToday: false },
  { dateIso: "2026-10-23", isCurrentMonth: true, isToday: true },
  { dateIso: "2026-10-25", isCurrentMonth: true, isToday: false },
];
it("retains a selected day even without appointments", () => {
  expect(selectCalendarDay(days, "2026-10-25")?.dateIso).toBe("2026-10-25");
});
it("defaults to today when the selection belongs to a different month", () => {
  expect(selectCalendarDay(days, "2026-09-30")?.dateIso).toBe("2026-10-23");
});
it("selects the first in-month day when browsing another month", () => {
  expect(selectCalendarDay(days.map(day => ({ ...day, isToday: false })), "2026-09-30")?.dateIso).toBe("2026-10-01");
});
it("does not invent a day for an empty calendar", () => {
  expect(selectCalendarDay([], "2026-10-23")).toBeUndefined();
});
it("snaps upward to week and downward to month after a deliberate drag", () => {
  expect(foldCalendarAfterDrag(false, -60)).toBe(true);
  expect(foldCalendarAfterDrag(true, 60)).toBe(false);
});
it("keeps the current view after a small or cancelled drag", () => {
  expect(foldCalendarAfterDrag(false, -12)).toBe(false);
  expect(foldCalendarAfterDrag(true, 12)).toBe(true);
});
