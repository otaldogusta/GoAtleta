import { buildSessionCalendar } from "../../../core/session-calendar-engine";

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
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  const calendar = buildSessionCalendar({
    classGroup: {
      daysOfWeek: params.daysOfWeek,
      daysPerWeek: params.weeklySessions,
      durationMinutes: 60,
    },
    startDate: params.startDate,
    endDate,
  });

  return calendar.sessions.map((session, index) => {
    const [year, month, day] = session.date.split("-");
    return {
      sessionIndex: index + 1,
      weekday: session.weekday,
      weekdayLabel: DAY_LABELS[session.weekday] ?? "?",
      date: session.date,
      dateLabel: `${day}/${month}/${year}`,
      shortLabel: `${DAY_LABELS[session.weekday] ?? "?"} ${day}/${month}`,
    };
  });
};
