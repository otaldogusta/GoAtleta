export type ScheduleSortable = {
  daysOfWeek: number[] | null;
  startTime: string | null;
  name: string | null;
};

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const getDayRank = (days: number[] | null) => {
  if (!days || !days.length) return 999;
  let min = 999;
  for (const day of days) {
    const idx = DAY_ORDER.indexOf(day);
    const rank = idx === -1 ? 999 : idx;
    if (rank < min) min = rank;
  }
  return min;
};

const getTimeRank = (startTime: string | null) => {
  if (!startTime) return 9999;
  const match = startTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 9999;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 9999;
  return hour * 60 + minute;
};

export const compareClassesBySchedule = (a: ScheduleSortable, b: ScheduleSortable) => {
  const dayDiff = getDayRank(a.daysOfWeek) - getDayRank(b.daysOfWeek);
  if (dayDiff !== 0) return dayDiff;
  const timeDiff = getTimeRank(a.startTime) - getTimeRank(b.startTime);
  if (timeDiff !== 0) return timeDiff;
  const nameA = (a.name ?? "").trim();
  const nameB = (b.name ?? "").trim();
  if (!nameA && !nameB) return 0;
  return nameA.localeCompare(nameB, "pt-BR");
};

export const sortClassesBySchedule = <T extends ScheduleSortable>(items: T[]) => {
  return [...items].sort(compareClassesBySchedule);
};
