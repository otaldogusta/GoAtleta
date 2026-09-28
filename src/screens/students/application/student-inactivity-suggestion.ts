import type { AttendanceRecord } from "../../../core/models";

export type StudentInactivitySuggestion = {
  studentId: string;
  consecutiveWeeks: number;
  latestAbsenceDate: string;
};

const toWeekStartKey = (value: string) => {
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value,
  );
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const deriveStudentInactivitySuggestions = (
  records: AttendanceRecord[],
  minimumConsecutiveWeeks = 4,
  now = new Date(),
) => {
  const byStudent = new Map<string, AttendanceRecord[]>();
  for (const record of records) {
    const current = byStudent.get(record.studentId) ?? [];
    current.push(record);
    byStudent.set(record.studentId, current);
  }

  const suggestions = new Map<string, StudentInactivitySuggestion>();
  for (const [studentId, studentRecords] of byStudent) {
    const weeks = new Map<string, AttendanceRecord[]>();
    for (const record of studentRecords) {
      const weekKey = toWeekStartKey(record.date);
      if (!weekKey) continue;
      const current = weeks.get(weekKey) ?? [];
      current.push(record);
      weeks.set(weekKey, current);
    }

    const orderedWeeks = [...weeks.entries()].sort(([left], [right]) =>
      right.localeCompare(left),
    );
    let consecutiveWeeks = 0;
    let latestAbsenceDate = "";
    let previousWeekStart: number | null = null;
    for (const [weekKey, weekRecords] of orderedWeeks) {
      const weekStart = new Date(`${weekKey}T12:00:00`).getTime();
      if (
        previousWeekStart !== null &&
        previousWeekStart - weekStart !== 7 * 24 * 60 * 60 * 1000
      ) {
        break;
      }
      const hasPresence = weekRecords.some(
        (record) => record.status !== "faltou",
      );
      const absenceDates = weekRecords
        .filter((record) => record.status === "faltou")
        .map((record) => record.date)
        .sort((left, right) => right.localeCompare(left));
      if (hasPresence || absenceDates.length === 0) break;
      consecutiveWeeks += 1;
      previousWeekStart = weekStart;
      if (!latestAbsenceDate) latestAbsenceDate = absenceDates[0];
    }

    const latestAbsenceMs = latestAbsenceDate
      ? new Date(`${latestAbsenceDate.slice(0, 10)}T12:00:00`).getTime()
      : 0;
    const isCurrentSequence =
      latestAbsenceMs > 0 &&
      now.getTime() - latestAbsenceMs <= 14 * 24 * 60 * 60 * 1000;
    if (consecutiveWeeks >= minimumConsecutiveWeeks && isCurrentSequence) {
      suggestions.set(studentId, {
        studentId,
        consecutiveWeeks,
        latestAbsenceDate,
      });
    }
  }
  return suggestions;
};
