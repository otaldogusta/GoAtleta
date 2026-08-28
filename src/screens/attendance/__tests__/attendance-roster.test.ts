import type { AttendanceRecord, Student } from "../../../core/models";
import {
  countMarkedAttendanceStudents,
  mergeAttendanceRecordsPreservingOpaque,
  resolveAttendanceStudentsForDate,
} from "../attendance-roster";

const student = (id: string, membershipStatus: Student["membershipStatus"]): Student =>
  ({ id, name: id, membershipStatus } as Student);

const record = (studentId: string): AttendanceRecord =>
  ({
    id: `attendance-${studentId}`,
    classId: "class-1",
    studentId,
    date: "2026-08-01",
    status: "presente",
    note: "",
    painScore: 0,
    createdAt: "2026-08-01T12:00:00.000Z",
  } as AttendanceRecord);

describe("attendance roster for a selected date", () => {
  test("counts only displayed students when a hidden historical status remains loaded", () => {
    const result = countMarkedAttendanceStudents(
      [student("active", "active")],
      {
        active: "faltou",
        inactive: "presente",
      },
    );

    expect(result).toBe(1);
  });

  test("keeps active students and only historical inactive students with records", () => {
    const result = resolveAttendanceStudentsForDate(
      [student("active", "active"), student("inactive-recorded", "inactive"), student("inactive-empty", "inactive")],
      [record("inactive-recorded")],
    );

    expect(result.map((item) => item.id)).toEqual(["active", "inactive-recorded"]);
  });

  test("keeps the current roster free of inactive students when the date has no records", () => {
    const result = resolveAttendanceStudentsForDate(
      [student("active", "active"), student("inactive", "inactive")],
      [],
    );

    expect(result.map((item) => item.id)).toEqual(["active"]);
  });

  test("preserves loaded records for identities outside the editable roster", () => {
    const editedVisible = { ...record("active"), status: "faltou" as const };
    const opaque = record("moved-or-unreadable");

    const result = mergeAttendanceRecordsPreservingOpaque(
      ["active"],
      [editedVisible],
      [record("active"), opaque],
    );

    expect(result).toEqual([editedVisible, opaque]);
  });
});
