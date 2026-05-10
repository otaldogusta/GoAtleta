const DAY_LABELS: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sab",
};

export type WeekSessionPreview = {
  sessionIndex: number;
  weekday: number;
  weekdayLabel: string;
  date: string;      // ISO: 2026-04-14
  dateLabel: string; // 14/04/2026
  shortLabel: string; // Ter 14/04
};

const parseIsoDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfCalendarWeek = (value: Date) => {
  const next = new Date(value);
  const weekday = next.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  next.setDate(next.getDate() + offset);
  return next;
};

/**
 * Builds the real session dates for the calendar week containing the anchor date.
 * The result is aligned to the Monday-Sunday window of that week, while allowing
 * callers to trim sessions before the true cycle start with `minDate`.
 */
export const buildWeekSessionPreview = (params: {
  startDate: string;
  daysOfWeek: number[];
  weeklySessions: number;
  minDate?: string | null;
  visibleMonthKey?: string | null;
}): WeekSessionPreview[] => {
  const anchorDate = parseIsoDate(params.startDate);
  if (!anchorDate) return [];
  const minDate = parseIsoDate(params.minDate);
  const start = startOfCalendarWeek(anchorDate);

  const allowedDays = new Set(
    [...params.daysOfWeek].sort((a, b) => a - b).slice(0, params.weeklySessions)
  );

  const results: WeekSessionPreview[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + offset);
    if (minDate && current.getTime() < minDate.getTime()) continue;
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
    if (params.visibleMonthKey && monthKey !== params.visibleMonthKey) continue;
    const weekday = current.getDay();
    if (!allowedDays.has(weekday)) continue;

    const day = String(current.getDate()).padStart(2, "0");
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const year = current.getFullYear();

    results.push({
      sessionIndex: results.length + 1,
      weekday,
      weekdayLabel: DAY_LABELS[weekday] ?? "?",
      date: `${year}-${month}-${day}`,
      dateLabel: `${day}/${month}/${year}`,
      shortLabel: `${DAY_LABELS[weekday] ?? "?"} ${day}/${month}`,
    });
  }

  return results;
};
