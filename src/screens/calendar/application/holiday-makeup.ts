import type { ClassGroup } from "../../../core/models";
import { nationalHoliday, type CalendarPause } from "../../../core/holidays";

export function isHolidayLesson(group: ClassGroup, date: string, pause?: CalendarPause) {
  const weekday = new Date(date + "T00:00:00Z").getUTCDay();
  if (!group.daysOfWeek.includes(weekday)) return false;
  if (pause) return /^feriado(?:$|:)/i.test(pause.reason?.trim() ?? "");
  return Boolean(nationalHoliday(date));
}

export function suggestOriginalDate(group: ClassGroup | undefined, destination: string, pauses: CalendarPause[], covered: Set<string>) {
  if (!group || !/^\d{4}-\d{2}-\d{2}$/.test(destination)) return "";
  const cursor = new Date(destination + "T00:00:00Z");
  if (!Number.isFinite(cursor.getTime())) return "";
  const byDate = new Map(pauses.filter(pause => pause.class_id === group.id).map(pause => [pause.date, pause]));
  // Offer the closest eligible lesson. Older occurrences remain selectable by date.
  for (let i = 0; i < 366; i++) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const date = cursor.toISOString().slice(0, 10);
    if (!covered.has(date) && isHolidayLesson(group, date, byDate.get(date))) return date;
  }
  return "";
}
