type CalendarDate = { dateIso: string; isCurrentMonth: boolean; isToday: boolean };

/** Keep selection inside the displayed month; empty days remain selectable. */
export function selectCalendarDay<T extends CalendarDate>(days: T[], selectedDate: string): T | undefined {
  return days.find(day => day.dateIso === selectedDate && day.isCurrentMonth)
    ?? days.find(day => day.isCurrentMonth && day.isToday)
    ?? days.find(day => day.isCurrentMonth);
}

export function foldCalendarAfterDrag(collapsed: boolean, distanceY: number): boolean {
  if (distanceY < -32) return true;
  if (distanceY > 32) return false;
  return collapsed;
}
