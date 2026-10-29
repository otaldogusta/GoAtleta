import { calendarDragParts } from "../application/calendar-drag";
import { advanceCalendarWebPosition } from "../application/calendar-web-drag";

it("keeps the native solver's gain-one transfer math in both directions", () => {
  expect(calendarDragParts(advanceCalendarWebPosition(260, -100, 200, 500), 200)).toEqual({ fold: 160, scroll: 0 });
  expect(calendarDragParts(advanceCalendarWebPosition(180, 100, 200, 500), 200)).toEqual({ fold: 200, scroll: 80 });
  expect(advanceCalendarWebPosition(700, 1000, 200, 500)).toBe(700);
  expect(advanceCalendarWebPosition(700, -100, 200, 500)).toBe(600);
});

it("uses half gain in the fold and full gain in the list with exact crossing remainder", () => {
  expect(calendarDragParts(advanceCalendarWebPosition(0, 100, 200, 500, 0.5), 200)).toEqual({ fold: 50, scroll: 0 });
  expect(calendarDragParts(advanceCalendarWebPosition(180, 100, 200, 500, 0.5), 200)).toEqual({ fold: 200, scroll: 60 });
  expect(calendarDragParts(advanceCalendarWebPosition(260, -100, 200, 500, 0.5), 200)).toEqual({ fold: 180, scroll: 0 });
  expect(calendarDragParts(advanceCalendarWebPosition(300, 100, 200, 500, 0.5), 200)).toEqual({ fold: 200, scroll: 200 });
});

it("reverses immediately after saturating and clamps when content shrinks", () => {
  const bottom = advanceCalendarWebPosition(650, 1000, 200, 500, 0.5);
  expect(bottom).toBe(700);
  expect(advanceCalendarWebPosition(bottom, -10, 200, 500, 0.5)).toBe(690);
  expect(advanceCalendarWebPosition(0, -1000, 200, 500, 0.5)).toBe(0);
  expect(advanceCalendarWebPosition(0, 10, 200, 500, 0.5)).toBe(5);
  expect(advanceCalendarWebPosition(700, 10, 200, 300, 0.5)).toBe(500);
});
