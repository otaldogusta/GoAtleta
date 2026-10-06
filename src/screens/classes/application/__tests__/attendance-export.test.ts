import type { AttendanceRecord, ClassGroup, Student } from "../../../../core/models";
import { buildClassDocumentPdfFileName } from "../../../../pdf/class-document-file-name";
import {
  buildAttendanceExportData,
  buildAttendanceExportFileParts,
  buildClassRosterPdfFileName,
  canAccessAttendanceExport,
  resolveClassRosterExportStudents,
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
  test("exports only eligible roster students even when review students have saved history", () => {
    const history = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].map((date, index) =>
      attendance(String(index), "class-a", "review", date, "faltou")
    );
    const originalHistory = history.map((record) => ({ ...record }));
    const result = resolveClassRosterExportStudents(
      [student("active", "Ana"), student("review", "Bia"), student("inactive", "Caio", "inactive")],
      history,
      new Date("2026-10-05T12:00:00"),
    );
    expect(result.map((item) => item.id)).toEqual(["active"]);
    expect(history).toEqual(originalHistory);
  });

  test("includes a reviewed student again after a presence breaks the absence sequence", () => {
    const history = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].map((date, index) =>
      attendance(String(index), "class-a", "review", date, "faltou")
    );
    history.push(attendance("returned", "class-a", "review", "2026-10-01", "presente"));
    expect(resolveClassRosterExportStudents(
      [student("review", "Bia")], history, new Date("2026-10-05T12:00:00"),
    ).map((item) => item.id)).toEqual(["review"]);
  });

  test("includes the class weekdays alongside its name in the PDF filename", () => {
    expect(buildClassRosterPdfFileName({
      className: "Raposas",
      daysLabel: "Seg e Qua",
      monthLabel: "Outubro 2026",
      includeAttendance: true,
      startTime: "14:00",
    })).toBe("Chamada - Raposas - Seg e Qua - 14h - Outubro 2026.pdf");
  });

  test("shares the roster naming convention with daily reports, preserving accents and the lesson date", () => {
    expect(buildClassDocumentPdfFileName({
      documentLabel: "Relatório",
      className: "Hipopótamos",
      daysLabel: "Qua e Sex",
      startTime: "18:00",
      periodLabel: "07-10-2026",
    })).toBe("Relatório - Hipopótamos - Qua e Sex - 18h - 07-10-2026.pdf");
    expect(buildClassDocumentPdfFileName({
      documentLabel: "Relatório",
      className: "Turma / Iniciação",
      startTime: "18:30",
      periodLabel: "09-10-2026",
    })).toBe("Relatório - Turma Iniciação - 18h30 - 09-10-2026.pdf");
  });

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

  test("names the roster PDF with its class and selected month", () => {
    expect(buildClassRosterPdfFileName({
      className: "Hipopótamos Qua e Sex",
      monthLabel: "Setembro 2026",
      includeAttendance: true,
      startTime: "18:00",
    })).toBe("Chamada - Hipopótamos Qua e Sex - 18h - Setembro 2026.pdf");

    expect(buildClassRosterPdfFileName({
      className: "Turma / Iniciação",
      monthLabel: "Outubro 2026",
      includeAttendance: false,
      startTime: "18:30",
    })).toBe("Lista de chamada - Turma Iniciação - 18h30 - Outubro 2026.pdf");
  });
});
