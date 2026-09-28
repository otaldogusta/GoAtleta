import { deriveStudentInactivitySuggestions } from "../student-inactivity-suggestion";

const record = (date: string, status: "presente" | "faltou") => ({
  id: `attendance-${date}-${status}`,
  classId: "class-1",
  studentId: "student-1",
  date,
  status,
  createdAt: `${date}T12:00:00.000Z`,
});

describe("deriveStudentInactivitySuggestions", () => {
  it("suggests review after four distinct consecutive attendance weeks with only absences", () => {
    const result = deriveStudentInactivitySuggestions(
      [
        record("2026-09-28", "faltou"),
        record("2026-09-21", "faltou"),
        record("2026-09-14", "faltou"),
        record("2026-09-07", "faltou"),
      ],
      4,
      new Date("2026-09-28T12:00:00"),
    );

    expect(result.get("student-1")).toMatchObject({ consecutiveWeeks: 4 });
  });

  it("does not suggest review when a presence breaks the sequence", () => {
    const result = deriveStudentInactivitySuggestions([
      record("2026-09-28", "faltou"),
      record("2026-09-21", "faltou"),
      record("2026-09-14", "presente"),
      record("2026-09-07", "faltou"),
      record("2026-08-31", "faltou"),
    ], 4, new Date("2026-09-28T12:00:00"));

    expect(result.has("student-1")).toBe(false);
  });

  it("counts a week once when the class has more than one call", () => {
    const result = deriveStudentInactivitySuggestions([
      record("2026-09-28", "faltou"),
      record("2026-09-30", "faltou"),
      record("2026-09-21", "faltou"),
      record("2026-09-14", "faltou"),
      record("2026-09-07", "faltou"),
    ], 4, new Date("2026-09-30T12:00:00"));

    expect(result.get("student-1")?.consecutiveWeeks).toBe(4);
  });

  it("does not join attendance weeks separated by a gap", () => {
    const result = deriveStudentInactivitySuggestions(
      [
        record("2026-09-28", "faltou"),
        record("2026-09-21", "faltou"),
        record("2026-09-07", "faltou"),
        record("2026-08-31", "faltou"),
      ],
      4,
      new Date("2026-09-28T12:00:00"),
    );

    expect(result.has("student-1")).toBe(false);
  });
});
