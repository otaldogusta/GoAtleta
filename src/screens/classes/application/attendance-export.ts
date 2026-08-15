import type { AttendanceRecord, ClassGroup, Student } from "../../../core/models";

export type AttendanceExportDetailRow = {
  date: string;
  unit: string;
  className: string;
  studentName: string;
  membershipStatus: "Ativo" | "Inativo";
  financialStatus: "Regular" | "Inadimplente";
  attendanceStatus: "Presente" | "Faltou";
  note: string;
  painScore: number;
};

export type AttendanceExportSummaryRow = {
  unit: string;
  className: string;
  sessions: number;
  present: number;
  absent: number;
  attendanceRate: number;
};

export type AttendanceExportData = {
  details: AttendanceExportDetailRow[];
  summary: AttendanceExportSummaryRow[];
  totalRecords: number;
  totalPresent: number;
  totalAbsent: number;
  attendanceRate: number;
};

type BuildAttendanceExportDataParams = {
  classes: ClassGroup[];
  students: Student[];
  records: AttendanceRecord[];
  startDate: string;
  endDate: string;
  unit?: string | null;
  classId?: string | null;
};

export function buildAttendanceExportData({
  classes,
  students,
  records,
  startDate,
  endDate,
  unit,
  classId,
}: BuildAttendanceExportDataParams): AttendanceExportData {
  const scopedClasses = classes.filter((item) => {
    if (unit && item.unit !== unit) return false;
    if (classId && item.id !== classId) return false;
    return true;
  });
  const classById = new Map(scopedClasses.map((item) => [item.id, item]));
  const studentById = new Map(students.map((item) => [item.id, item]));
  const scopedRecords = records
    .filter(
      (record) =>
        classById.has(record.classId) &&
        record.date >= startDate &&
        record.date <= endDate
    )
    .sort((left, right) => {
      const byDate = left.date.localeCompare(right.date);
      if (byDate !== 0) return byDate;
      const leftClass = classById.get(left.classId)?.name ?? "";
      const rightClass = classById.get(right.classId)?.name ?? "";
      return leftClass.localeCompare(rightClass, "pt-BR");
    });

  const details = scopedRecords.map<AttendanceExportDetailRow>((record) => {
    const classGroup = classById.get(record.classId)!;
    const student = studentById.get(record.studentId);
    return {
      date: record.date,
      unit: classGroup.unit,
      className: classGroup.name,
      studentName: student?.name ?? "Aluno não localizado",
      membershipStatus: student?.membershipStatus === "inactive" ? "Inativo" : "Ativo",
      financialStatus:
        student?.financialStatus === "delinquent" ? "Inadimplente" : "Regular",
      attendanceStatus: record.status === "presente" ? "Presente" : "Faltou",
      note: record.note,
      painScore: record.painScore,
    };
  });

  const summary = scopedClasses
    .map<AttendanceExportSummaryRow>((classGroup) => {
      const classRecords = scopedRecords.filter((record) => record.classId === classGroup.id);
      const present = classRecords.filter((record) => record.status === "presente").length;
      const absent = classRecords.length - present;
      return {
        unit: classGroup.unit,
        className: classGroup.name,
        sessions: new Set(classRecords.map((record) => record.date)).size,
        present,
        absent,
        attendanceRate: classRecords.length
          ? Math.round((present / classRecords.length) * 100)
          : 0,
      };
    })
    .filter((row) => row.sessions > 0)
    .sort((left, right) => {
      const byUnit = left.unit.localeCompare(right.unit, "pt-BR");
      return byUnit !== 0 ? byUnit : left.className.localeCompare(right.className, "pt-BR");
    });

  const totalPresent = details.filter((row) => row.attendanceStatus === "Presente").length;
  const totalAbsent = details.length - totalPresent;

  return {
    details,
    summary,
    totalRecords: details.length,
    totalPresent,
    totalAbsent,
    attendanceRate: details.length ? Math.round((totalPresent / details.length) * 100) : 0,
  };
}
