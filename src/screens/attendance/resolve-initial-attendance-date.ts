type AttendanceDateStudent = {
  id: string;
  createdAt?: string | null;
};

type AttendanceDateRecord = {
  date: string;
  studentId: string;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatLocalDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;

const toDateKey = (value: string | null | undefined) => {
  const candidate = String(value ?? "").slice(0, 10);
  return ISO_DATE_PATTERN.test(candidate) ? candidate : null;
};

const parseLocalDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const previousDay = (value: Date) => {
  const next = new Date(value);
  next.setDate(next.getDate() - 1);
  return next;
};

/**
 * Picks the most recent scheduled class day whose attendance does not cover
 * every student who already existed on that date. If the available history is
 * complete, it keeps the latest scheduled day as the operational default.
 */
export function resolveInitialAttendanceDate(params: {
  today: Date;
  classDays: number[] | null | undefined;
  classCreatedAt?: string | null;
  students: AttendanceDateStudent[];
  records: AttendanceDateRecord[];
}) {
  const todayKey = formatLocalDateKey(params.today);
  const validClassDays = new Set(
    (params.classDays ?? []).filter(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6
    )
  );

  if (validClassDays.size === 0) return todayKey;

  const attendanceByDate = new Map<string, Set<string>>();
  params.records.forEach((record) => {
    const dateKey = toDateKey(record.date);
    if (!dateKey || dateKey > todayKey) return;
    const students = attendanceByDate.get(dateKey) ?? new Set<string>();
    students.add(record.studentId);
    attendanceByDate.set(dateKey, students);
  });

  const studentCreatedAt = new Map(
    params.students.map((student) => [student.id, toDateKey(student.createdAt)])
  );
  const classCreatedAt = toDateKey(params.classCreatedAt);
  const fallbackLowerBound = new Date(params.today);
  fallbackLowerBound.setFullYear(fallbackLowerBound.getFullYear() - 10);
  const lowerBound =
    (classCreatedAt && classCreatedAt <= todayKey ? classCreatedAt : null) ??
    formatLocalDateKey(fallbackLowerBound);

  let cursor = parseLocalDateKey(todayKey) ?? new Date(params.today);
  let latestScheduledDate: string | null = null;

  while (formatLocalDateKey(cursor) >= lowerBound) {
    const candidate = formatLocalDateKey(cursor);
    if (!validClassDays.has(cursor.getDay())) {
      cursor = previousDay(cursor);
      continue;
    }

    latestScheduledDate ??= candidate;
    const expectedStudentIds = params.students
      .filter((student) => {
        const createdAt = studentCreatedAt.get(student.id);
        return !createdAt || createdAt <= candidate;
      })
      .map((student) => student.id);

    if (expectedStudentIds.length > 0) {
      const recordedStudentIds = attendanceByDate.get(candidate) ?? new Set<string>();
      const isComplete = expectedStudentIds.every((studentId) =>
        recordedStudentIds.has(studentId)
      );
      if (!isComplete) return candidate;
    }

    cursor = previousDay(cursor);
  }

  return latestScheduledDate ?? todayKey;
}
