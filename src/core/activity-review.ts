import type { ClassGroup } from "./models";
import { isPaused, type CalendarPause } from "./holidays";

export type ActivityReview = { class_ids: string[]; start_date: string; end_date: string };
export type MissingClassActivity = { classId: string; name: string; unit: string; dates: string[] };
export function missingClassActivity(input: {
  classes: ClassGroup[]; attendance: { classid: string; date: string }[];
  pauses: CalendarPause[]; reviews: ActivityReview[]; today: string;
}): MissingClassActivity[] {
  const recorded = new Set(input.attendance.map(row => `${row.classid}:${row.date.slice(0, 10)}`));
  return input.classes.flatMap(cls => {
    const dates: string[] = [];
    const created = cls.createdAt?.slice(0, 10);
    // Unknown creation dates cannot establish a reliable expected-history window.
    if (!created || !/^\d{4}-\d{2}-\d{2}$/.test(created)) return [];
    const start = cls.cycleStartDate > created ? cls.cycleStartDate : created;
    for (let offset = 1; offset <= 28; offset += 1) {
      const day = new Date(`${input.today}T12:00:00Z`);
      day.setUTCDate(day.getUTCDate() - offset);
      const date = day.toISOString().slice(0, 10);
      if (date < start) break;
      if (!cls.daysOfWeek.includes(day.getUTCDay()) || isPaused(input.pauses, cls.id, date)) continue;
      if (recorded.has(`${cls.id}:${date}`)) break;
      dates.push(date);
    }
    if (dates.length < 3 || input.reviews.some(r => r.class_ids.includes(cls.id) && r.start_date <= dates[0] && r.end_date >= dates[0])) return [];
    return [{ classId: cls.id, name: cls.name, unit: cls.unit, dates }];
  }).sort((a, b) => b.dates.length - a.dates.length || a.name.localeCompare(b.name));
}
