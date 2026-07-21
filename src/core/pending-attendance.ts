export type PendingAttendanceCandidate = {
  classId: string;
  targetDate: string;
};

export type PendingAttendanceClassSchedule = {
  id: string;
  daysOfWeek: number[] | null | undefined;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | string | null;
};

const toDateKey = (value: string) => (value.includes("T") ? value.split("T")[0] : value);

const formatLocalDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;

const parseTimeToMinutes = (value: string | null | undefined) => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

const resolveClassEndMinutes = (schedule: PendingAttendanceClassSchedule) => {
  const explicitEnd = parseTimeToMinutes(schedule.endTime);
  if (explicitEnd !== null) return explicitEnd;

  const start = parseTimeToMinutes(schedule.startTime);
  const duration = Number(schedule.durationMinutes);
  if (start === null || !Number.isFinite(duration) || duration <= 0) return null;
  return start + duration;
};

export function filterActionablePendingAttendance<T extends PendingAttendanceCandidate>(params: {
  candidates: T[];
  schedules: PendingAttendanceClassSchedule[];
  now: Date;
}): T[] {
  const todayKey = formatLocalDateKey(params.now);
  const nowMinutes = params.now.getHours() * 60 + params.now.getMinutes();
  const weekday = params.now.getDay();
  const scheduleByClassId = new Map(params.schedules.map((schedule) => [schedule.id, schedule]));

  return params.candidates.filter((candidate) => {
    const targetDate = toDateKey(candidate.targetDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return false;
    if (targetDate < todayKey) return true;
    if (targetDate > todayKey) return false;

    const schedule = scheduleByClassId.get(candidate.classId);
    if (!schedule) return false;

    const scheduledWeekdays = (schedule.daysOfWeek ?? []).filter(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6
    );
    if (!scheduledWeekdays.includes(weekday)) return false;

    const endMinutes = resolveClassEndMinutes(schedule);
    return endMinutes !== null && endMinutes <= nowMinutes;
  });
}
