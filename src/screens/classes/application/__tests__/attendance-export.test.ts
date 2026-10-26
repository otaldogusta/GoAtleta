import { buildAttendanceMonthlyPages, paginateAttendanceSummary, groupAttendanceExportDetails } from "../attendance-export-groups";
import type { AttendanceRecord, ClassGroup, Student } from "../../../../core/models";
import { buildClassDocumentPdfFileName } from "../../../../pdf/class-document-file-name";
import {
  buildAttendanceExportClassInfo,
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


test("keeps each class together across months and years, including namesakes", () => {
  const result = buildAttendanceExportData({
    classes: [classGroup("a", "Águias", "Centro"), classGroup("b", "Águias", "Centro")],
    students: [student("s", "Ana")],
    records: [
      attendance("1", "b", "s", "2026-01-01", "presente"),
      attendance("2", "a", "s", "2026-01-02", "faltou"),
      attendance("3", "a", "s", "2025-12-10", "presente"),
      attendance("4", "a", "s", "2026-01-01", "presente"),
    ],
    startDate: "2025-12-01", endDate: "2026-01-31",
  });
  const original = [...result.details];
  const groups = groupAttendanceExportDetails(result.details);
  expect(groups.map((group) => group.key)).toEqual(["a", "b"]);
  expect(groups[0].months.map((month) => month.label)).toEqual(["Dezembro de 2025", "Janeiro de 2026"]);
  expect(groups[0].months[1].rows.map((row) => row.date)).toEqual(["2026-01-01", "2026-01-02"]);
  expect(groups.flatMap((group) => group.months.flatMap((month) => month.rows))).toHaveLength(4);
  expect(result.details).toEqual(original);
  expect(groupAttendanceExportDetails([])).toEqual([]);
});


test("exports the same current class identity, schedule and development labels as the class list", () => {
  const group = { ...classGroup("a", "Hipopótamos", "Centro"), startTime: "18:00", durationMinutes: 60, daysOfWeek: [3, 5], ageBand: "09-11", mvLevel: "MV2", level: 1, gender: "misto", trainingSpace: "Quadra 2" } as ClassGroup;
  const result = buildAttendanceExportData({ classes: [group], students: [student("s", "Ana")], records: [attendance("1", "a", "s", "2026-10-01", "presente")], startDate: "2026-10-01", endDate: "2026-10-31" });
  expect(result.details[0]).toMatchObject({ studentId: "s", classId: "a", classInfo: { scheduleLabel: "18:00 - 19:00", daysLabel: "Qua, Sex", ageBandLabel: "09-11", levelLabel: "Intermediário", genderLabel: "Misto", trainingSpace: "Quadra 2" } });
  expect(result.summary[0].classInfo).toEqual(result.details[0].classInfo);
  expect(buildAttendanceExportClassInfo(classGroup("empty", "Sem horário", "Centro"))).toMatchObject({ scheduleLabel: "Horário não definido", ageBandLabel: "Faixa não definida", levelLabel: "Nível não definido" });
});

test("monthly PDF pages preserve missing marks, namesakes and every record across row/date parts", () => {
  const records = Array.from({ length: 31 }, (_, day) => Array.from({ length: 35 }, (_, index) => attendance(`${day}-${index}`, "a", `s${index}`, `2026-10-${String(day + 1).padStart(2, "0")}`, index % 2 ? "presente" : "faltou"))).flat();
  records.pop(); // No record is never converted into a failure.
  const result = buildAttendanceExportData({ classes: [classGroup("a", "Hipopótamos", "Centro")], students: Array.from({ length: 35 }, (_, i) => student(`s${i}`, "Mesmo nome")), records, startDate: "2026-10-01", endDate: "2026-10-31" });
  const pages = buildAttendanceMonthlyPages(result.details);
  expect(pages).toHaveLength(9);
  const exportedMarks = pages.flatMap((page) => page.athletes.flatMap((athlete) => page.dates.flatMap((date) => athlete.statuses.get(date) ?? [])));
  expect(exportedMarks).toHaveLength(records.length);
  expect(exportedMarks.filter((mark) => mark === "F")).toHaveLength(result.totalAbsent);
  expect(pages.every((page) => page.dates.length <= 12 && page.athletes.length <= 17)).toBe(true);
  const missing = pages.find((page) => page.dates.includes("2026-10-31") && page.athletes.some((athlete) => athlete.key === "s34"))!;
  expect(missing.athletes.find((athlete) => athlete.key === "s34")!.statuses.has("2026-10-31")).toBe(false);
});


test("repeats bounded summary pages without losing classes", () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ classId: String(index), unit: "Centro", className: `Turma ${index}`, professorNames: "Joana", sessions: 1, present: 1, absent: 0, attendanceRate: 100 }));
  const parts = paginateAttendanceSummary(rows);
  expect(parts.map((part) => part.length)).toEqual([9, 9, 2]);
  expect(parts.flat()).toEqual(rows);
});
