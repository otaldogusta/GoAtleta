import type { AttendanceRecord, Student } from "../../core/models";
import { deriveStudentInactivitySuggestions } from "../students/application/student-inactivity-suggestion";

export function countMarkedAttendanceStudents(
  students: Pick<Student, "id">[],
  statusById: Readonly<Record<string, AttendanceRecord["status"] | undefined>>,
) {
  return students.reduce(
    (count, student) => count + (statusById[student.id] ? 1 : 0),
    0,
  );
}

export function resolveAttendanceStudentsForDate(
  students: Student[],
  records: AttendanceRecord[],
  history: AttendanceRecord[] = [],
  now = new Date(),
) {
  const recordedStudentIds = new Set(records.map((record) => record.studentId));
  const reviews = deriveStudentInactivitySuggestions(history, 4, now);
  return students.filter(
    (student) =>
      (student.membershipStatus !== "inactive" && !reviews.has(student.id)) ||
      recordedStudentIds.has(student.id),
  );
}

export function mergeAttendanceRecordsPreservingOpaque(
  visibleStudentIds: Iterable<string>,
  visibleRecords: AttendanceRecord[],
  loadedRecords: AttendanceRecord[],
) {
  const visibleIds = new Set(visibleStudentIds);
  return [
    ...visibleRecords,
    ...loadedRecords.filter((record) => !visibleIds.has(record.studentId)),
  ];
}
