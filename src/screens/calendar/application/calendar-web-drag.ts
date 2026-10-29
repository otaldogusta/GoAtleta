import { calendarDragPosition } from "./calendar-drag";

/** Consume input at the fold gain, then transfer the exact remainder at list gain 1. */
export function advanceCalendarWebPosition(start: number, delta: number, travel: number, maxScroll: number, foldGain = 1) {
  const gain = Math.max(0.01, Math.min(1, foldGain));
  const position = calendarDragPosition(start, 0, travel, maxScroll);
  let next = position;
  if (delta > 0) {
    const foldInput = Math.min(delta, Math.max(0, travel - position) / gain);
    next += foldInput * gain + delta - foldInput;
  } else if (delta < 0) {
    const scrollInput = Math.min(-delta, Math.max(0, position - travel));
    next -= scrollInput + (-delta - scrollInput) * gain;
  }
  return calendarDragPosition(next, 0, travel, maxScroll);
}
