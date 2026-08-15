import type { AttendanceRecord, ClassGroup, Student } from "../../../../core/models";
import { buildAttendanceExportData } from "../attendance-export";

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
        financialStatus: "Inadimplente",
      })
    );
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
});
