import { resolveInitialAttendanceDate } from "../resolve-initial-attendance-date";

const students = [
  { id: "student-1", createdAt: "2026-07-01T10:00:00.000Z" },
  { id: "student-2", createdAt: "2026-07-01T10:00:00.000Z" },
];

describe("resolveInitialAttendanceDate", () => {
  it("opens the latest scheduled day when its attendance is empty", () => {
    expect(
      resolveInitialAttendanceDate({
        today: new Date(2026, 7, 1),
        classDays: [1, 3],
        classCreatedAt: "2026-07-01T10:00:00.000Z",
        students,
        records: [],
      })
    ).toBe("2026-07-29");
  });

  it("walks back to the most recent incomplete attendance", () => {
    expect(
      resolveInitialAttendanceDate({
        today: new Date(2026, 7, 1),
        classDays: [1, 3],
        classCreatedAt: "2026-07-01T10:00:00.000Z",
        students,
        records: [
          { date: "2026-07-29", studentId: "student-1" },
          { date: "2026-07-29", studentId: "student-2" },
          { date: "2026-07-27", studentId: "student-1" },
        ],
      })
    ).toBe("2026-07-27");
  });

  it("keeps the latest scheduled day when all available history is complete", () => {
    expect(
      resolveInitialAttendanceDate({
        today: new Date(2026, 6, 8),
        classDays: [1, 3],
        classCreatedAt: "2026-07-06T10:00:00.000Z",
        students,
        records: [
          { date: "2026-07-08", studentId: "student-1" },
          { date: "2026-07-08", studentId: "student-2" },
          { date: "2026-07-06", studentId: "student-1" },
          { date: "2026-07-06", studentId: "student-2" },
        ],
      })
    ).toBe("2026-07-08");
  });

  it("does not treat a not-yet-created student as missing in older attendance", () => {
    expect(
      resolveInitialAttendanceDate({
        today: new Date(2026, 6, 8),
        classDays: [1, 3],
        classCreatedAt: "2026-07-06T10:00:00.000Z",
        students: [
          students[0],
          { id: "student-2", createdAt: "2026-07-08T10:00:00.000Z" },
        ],
        records: [
          { date: "2026-07-08", studentId: "student-1" },
          { date: "2026-07-08", studentId: "student-2" },
          { date: "2026-07-06", studentId: "student-1" },
        ],
      })
    ).toBe("2026-07-08");
  });

  it("uses today when the class has no weekday restriction", () => {
    expect(
      resolveInitialAttendanceDate({
        today: new Date(2026, 7, 1),
        classDays: [],
        students,
        records: [],
      })
    ).toBe("2026-08-01");
  });
});
