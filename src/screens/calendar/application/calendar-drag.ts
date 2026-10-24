/** One continuous distance: fold the month first, then consume list offset. */
export function calendarDragPosition(start: number, translationY: number, travel: number, maxScroll: number) {
  "worklet";
  return Math.max(0, Math.min(travel + Math.max(0, maxScroll), start - translationY));
}

export function calendarDragParts(position: number, travel: number) {
  "worklet";
  return { fold: Math.min(travel, Math.max(0, position)), scroll: Math.max(0, position - travel) };
}
