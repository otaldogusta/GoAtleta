import { calendarDragParts, calendarDragPosition } from "../application/calendar-drag";

it("keeps every pixel continuous across the month/list boundary in both directions", () => {
  const parts = (start: number, dy: number) => calendarDragParts(calendarDragPosition(start, dy, 295, 500), 295);
  expect(parts(0, -30)).toEqual({ fold: 30, scroll: 0 });
  expect(parts(0, -60)).toEqual({ fold: 60, scroll: 0 });
  expect(parts(0, -294)).toEqual({ fold: 294, scroll: 0 });
  expect(parts(0, -296)).toEqual({ fold: 295, scroll: 1 });
  expect(parts(395, 99)).toEqual({ fold: 295, scroll: 1 });
  expect(parts(395, 101)).toEqual({ fold: 294, scroll: 0 });
});

it("reverses during the same drag without resetting list or calendar distance", () => {
  expect(calendarDragPosition(0, -400, 295, 500)).toBe(400);
  expect(calendarDragPosition(0, -310, 295, 500)).toBe(310);
  expect(calendarDragPosition(0, -200, 295, 500)).toBe(200);
  expect(calendarDragPosition(0, -1000, 295, 500)).toBe(795);
  expect(calendarDragPosition(395, 1000, 295, 500)).toBe(0);
});
