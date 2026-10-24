import { calendarReturnRoute } from "../calendar-return-route";
it("returns to the originating calendar with selected date and unit", () => {
  expect(calendarReturnRoute("prof", "2026-10-24", "Capão da Imbuia")).toEqual({ pathname: "/prof/calendar", params: { targetDate: "2026-10-24", unit: "Capão da Imbuia" } });
  expect(calendarReturnRoute("shared", "2026-11-01", undefined)?.pathname).toBe("/calendar");
});
it("does not accept arbitrary destinations or invalid dates", () => {
  expect(calendarReturnRoute("https://example.com", "2026-10-24", "Todas")).toBeNull();
  expect(calendarReturnRoute("prof", "2026-02-30", "Todas")).toBeNull();
  expect(calendarReturnRoute(undefined, undefined, undefined)).toBeNull();
});
