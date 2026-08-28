import type { AttendanceRecord, ClassGroup, Student } from "../../../../core/models";
import {
  buildAttendanceExportData,
  buildAttendanceExportFileParts,
  canAccessAttendanceExport,
} from "../attendance-export";

const classGroup = (id: string, name: string, unit: string): ClassGroup =>
  ({ id, name, unit, organizationId: "org-1" } as ClassGroup);

const student = (
  id: string,
  name: string,
  membershipStatus: Student["membershipStatus"] = "active",
  financialStatus: Student["financialStatus"] = "regular"
): Student =>
  ({ id, name, membershipStatus, financialStatus } as Student);

const attendance = (
  id: string,
  classId: string,
  studentId: string,
  date: string,
  status: AttendanceRecord["status"]
): AttendanceRecord =>
  ({ id, classId, studentId, date, status, note: "", painScore: 0, createdAt: date } as AttendanceRecord);

describe("attendance operational export", () => {
  const classes = [
    classGroup("class-a", "Águias", "Centro"),
    classGroup("class-b", "Estrelas", "Norte"),
  ];
  const students = [
    student("student-a", "Ana"),
    student("student-b", "Bia", "inactive", "delinquent"),
  ];
  const records = [
    attendance("1", "class-a", "student-a", "2026-08-01", "presente"),
    attendance("2", "class-a", "student-b", "2026-08-01", "faltou"),
    attendance("3", "class-a", "student-a", "2026-08-03", "presente"),
    attendance("4", "class-b", "student-a", "2026-08-02", "presente"),
    attendance("5", "class-b", "student-a", "2026-07-31", "presente"),
  ];

  test("builds detailed records and summaries without dropping inactive history", () => {
    const result = buildAttendanceExportData({
      classes,
      students,
      records,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });

    expect(result.totalRecords).toBe(4);
    expect(result.totalPresent).toBe(3);
    expect(result.totalAbsent).toBe(1);
    expect(result.attendanceRate).toBe(75);
    expect(result.details).toContainEqual(
      expect.objectContaining({
        studentName: "Bia",
        membershipStatus: "Inativo",
      })
    );
    expect(result.details[0]).not.toHaveProperty("financialStatus");
    expect(result.details[0]).not.toHaveProperty("note");
    expect(result.details[0]).not.toHaveProperty("painScore");
    expect(result.summary).toContainEqual(
      expect.objectContaining({ className: "Águias", sessions: 2, attendanceRate: 67 })
    );
  });

  test("filters by unit and class scope", () => {
    const result = buildAttendanceExportData({
      classes,
      students,
      records,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      unit: "Norte",
      classId: "class-b",
    });

    expect(result.totalRecords).toBe(1);
    expect(result.summary.map((row) => row.className)).toEqual(["Estrelas"]);
  });

  test("filters classes by assigned professor and keeps professor identity in rows", () => {
    const classStaffAssignments = [
      {
        classId: "class-a",
        userId: "professor-a",
        staffRole: "head" as const,
        displayName: "Professora Joana",
      },
      {
        classId: "class-b",
        userId: "professor-b",
        staffRole: "assistant" as const,
        displayName: "Professor Caio",
      },
      {
        classId: "class-a",
        userId: "intern-a",
        staffRole: "intern" as const,
        displayName: "Estagiária Lia",
      },
    ];
    const result = buildAttendanceExportData({
      classes,
      students,
      records,
      classStaffAssignments,
      professorId: "professor-a",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });

    expect(result.totalRecords).toBe(3);
    expect(result.summary).toEqual([
      expect.objectContaining({
        className: "Águias",
        professorNames: "Professora Joana",
      }),
    ]);
    expect(result.details.every((row) => row.professorNames === "Professora Joana")).toBe(true);
  });

  test("combines athlete, attendance and membership filters", () => {
    const result = buildAttendanceExportData({
      classes,
      students,
      records,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      studentId: "student-b",
      attendanceStatus: "faltou",
      membershipStatus: "inactive",
    });

    expect(result.totalRecords).toBe(1);
    expect(result.totalPresent).toBe(0);
    expect(result.totalAbsent).toBe(1);
    expect(result.attendanceRate).toBe(0);
    expect(result.details).toEqual([
      expect.objectContaining({
        date: "2026-08-01",
        studentName: "Bia",
        membershipStatus: "Inativo",
        attendanceStatus: "Faltou",
      }),
    ]);
  });

  test("keeps aggregate metrics independent from the presence detail filter", () => {
    const result = buildAttendanceExportData({
      classes,
      students,
      records,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      classId: "class-a",
      attendanceStatus: "faltou",
    });

    expect(result.details).toHaveLength(1);
    expect(result.totalRecords).toBe(1);
    expect(result.totalPresent).toBe(2);
    expect(result.totalAbsent).toBe(1);
    expect(result.attendanceRate).toBe(67);
    expect(result.summary).toContainEqual(
      expect.objectContaining({ className: "Águias", present: 2, absent: 1, attendanceRate: 67 }),
    );
  });

  test("keeps unknown historical identities explicit instead of assuming an active link", () => {
    const result = buildAttendanceExportData({
      classes,
      students: [],
      records: [attendance("missing", "class-a", "student-missing", "2026-08-04", "presente")],
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });

    expect(result.details).toEqual([
      expect.objectContaining({
        studentName: "Aluno não localizado",
        membershipStatus: "Não localizado",
      }),
    ]);
  });

  test("returns no rows when a current membership filter cannot be resolved", () => {
    const result = buildAttendanceExportData({
      classes,
      students: [],
      records: [attendance("missing", "class-a", "student-missing", "2026-08-04", "presente")],
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      membershipStatus: "active",
    });

    expect(result.totalRecords).toBe(0);
  });

  test("requires reports permission for non-admin attendance export access", () => {
    expect(canAccessAttendanceExport({ roleLevel: 50, reportsAllowed: false, permissionsLoading: true })).toBe(true);
    expect(canAccessAttendanceExport({ roleLevel: 10, reportsAllowed: true, permissionsLoading: false })).toBe(true);
    expect(canAccessAttendanceExport({ roleLevel: 10, reportsAllowed: false, permissionsLoading: false })).toBe(false);
    expect(canAccessAttendanceExport({ roleLevel: 10, reportsAllowed: true, permissionsLoading: true })).toBe(false);
  });

  test("includes active export filters in the file name parts", () => {
    expect(buildAttendanceExportFileParts({
      scope: "Águias",
      professorName: "Professora Joana",
      studentName: "Ana Souza",
      attendanceStatus: "faltou",
      membershipStatus: "inactive",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    })).toEqual([
      "chamadas",
      "Águias",
      "Professora Joana",
      "Ana Souza",
      "faltas",
      "inativos",
      "2026-08-01",
      "2026-08-31",
    ]);
  });
});
