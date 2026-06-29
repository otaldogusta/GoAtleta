import type { ClassGroup } from "../core/models";

export type WebSidebarNextClass = {
  classId: string;
  className: string;
  unit: string;
  dayLabel: string;
  timeLabel: string;
  startsAt: Date;
};

export type WebSidebarViewModel = {
  totalClasses: number;
  totalStudents: number;
  unreadNotifications: number;
  todayClassCount: number;
  nextClass: WebSidebarNextClass | null;
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const parseTimeToMinutes = (time: string | null | undefined) => {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

const dateAtMinutes = (base: Date, minutes: number, dayOffset: number) => {
  const next = new Date(base);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + dayOffset);
  next.setMinutes(minutes);
  return next;
};

const getDayOffset = (today: number, target: number) => (target - today + 7) % 7;

const getDayLabel = (dayOffset: number, day: number) => {
  if (dayOffset === 0) return "Hoje";
  if (dayOffset === 1) return "Amanha";
  return DAY_LABELS[day] ?? "Aula";
};

export function buildWebSidebarViewModel(input: {
  classes?: ClassGroup[] | null;
  studentCount?: number | null;
  unreadCount?: number | null;
  now?: Date;
}): WebSidebarViewModel {
  const classes = Array.isArray(input.classes) ? input.classes : [];
  const now = input.now ?? new Date();
  const today = now.getDay();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const upcoming: WebSidebarNextClass[] = [];

  for (const classGroup of classes) {
    const startMinute = parseTimeToMinutes(classGroup.startTime);
    if (startMinute === null) continue;

    for (const day of classGroup.daysOfWeek ?? []) {
      if (!Number.isInteger(day) || day < 0 || day > 6) continue;
      let dayOffset = getDayOffset(today, day);
      if (dayOffset === 0 && startMinute <= currentMinute) {
        dayOffset = 7;
      }

      upcoming.push({
        classId: classGroup.id,
        className: classGroup.name,
        unit: classGroup.unit,
        dayLabel: getDayLabel(dayOffset, day),
        timeLabel: classGroup.endTime
          ? `${classGroup.startTime} - ${classGroup.endTime}`
          : classGroup.startTime,
        startsAt: dateAtMinutes(now, startMinute, dayOffset),
      });
    }
  }

  upcoming.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return {
    totalClasses: classes.length,
    totalStudents: Math.max(0, input.studentCount ?? 0),
    unreadNotifications: Math.max(0, input.unreadCount ?? 0),
    todayClassCount: classes.filter((classGroup) =>
      (classGroup.daysOfWeek ?? []).includes(today)
    ).length,
    nextClass: upcoming[0] ?? null,
  };
}
