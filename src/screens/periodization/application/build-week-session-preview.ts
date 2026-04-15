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

/**
 * Builds the real session dates for a week given the week start date and class schedule.
 * Iterates all 7 days from startDate and picks the ones matching daysOfWeek (JS convention: 0=Sun..6=Sat).
 */
export const buildWeekSessionPreview = (params: {
  startDate: string;
  daysOfWeek: number[];
  weeklySessions: number;
}): WeekSessionPreview[] => {
  const start = new Date(`${params.startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];

  const allowedDays = new Set(
    [...params.daysOfWeek].sort((a, b) => a - b).slice(0, params.weeklySessions)
  );

  const results: WeekSessionPreview[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + offset);
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
