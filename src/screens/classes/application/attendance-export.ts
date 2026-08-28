import type { AttendanceRecord, ClassGroup, Student } from "../../../core/models";

export type AttendanceExportDetailRow = {
  date: string;
  unit: string;
  className: string;
  professorNames: string;
  studentName: string;
  membershipStatus: "Ativo" | "Inativo" | "Não localizado";
  attendanceStatus: "Presente" | "Faltou";
};

export type AttendanceExportStatusFilter = AttendanceRecord["status"] | "all";
export type AttendanceExportMembershipFilter = Student["membershipStatus"] | "all";

type AttendanceExportSourceStudent = Pick<
  Student,
  "id" | "name" | "membershipStatus"
>;
type AttendanceExportSourceRecord = Pick<
  AttendanceRecord,
  "classId" | "studentId" | "date" | "status"
>;

export type AttendanceExportSummaryRow = {
  unit: string;
  className: string;
  professorNames: string;
  sessions: number;
  present: number;
  absent: number;
  attendanceRate: number;
};

export type AttendanceExportClassStaff = {
  classId: string;
  userId: string;
  staffRole: "head" | "assistant" | "intern";
  displayName?: string | null;
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
  students: AttendanceExportSourceStudent[];
  records: AttendanceExportSourceRecord[];
  classStaffAssignments?: AttendanceExportClassStaff[];
  startDate: string;
  endDate: string;
  unit?: string | null;
  classId?: string | null;
  professorId?: string | null;
  studentId?: string | null;
  attendanceStatus?: AttendanceExportStatusFilter | null;
  membershipStatus?: AttendanceExportMembershipFilter | null;
};

export function buildAttendanceExportData({
  classes,
  students,
  records,
  classStaffAssignments = [],
  startDate,
  endDate,
  unit,
  classId,
  professorId,
  studentId,
  attendanceStatus,
  membershipStatus,
}: BuildAttendanceExportDataParams): AttendanceExportData {
  const professorAssignments = classStaffAssignments.filter(
    (assignment) => assignment.staffRole !== "intern",
  );
  const professorIdsByClass = new Map<string, Set<string>>();
  const professorNamesByClass = new Map<string, Set<string>>();
  for (const assignment of professorAssignments) {
    const ids = professorIdsByClass.get(assignment.classId) ?? new Set<string>();
    ids.add(assignment.userId);
    professorIdsByClass.set(assignment.classId, ids);

    const displayName = assignment.displayName?.trim();
    if (displayName) {
      const names = professorNamesByClass.get(assignment.classId) ?? new Set<string>();
      names.add(displayName);
      professorNamesByClass.set(assignment.classId, names);
    }
  }
  const getProfessorNames = (targetClassId: string) => {
    const names = Array.from(professorNamesByClass.get(targetClassId) ?? [])
      .sort((left, right) => left.localeCompare(right, "pt-BR"));
    return names.length ? names.join(", ") : "Professor não definido";
  };
  const scopedClasses = classes.filter((item) => {
    if (unit && item.unit !== unit) return false;
    if (classId && item.id !== classId) return false;
    if (professorId && !professorIdsByClass.get(item.id)?.has(professorId)) return false;
    return true;
  });
  const classById = new Map(scopedClasses.map((item) => [item.id, item]));
  const studentById = new Map(students.map((item) => [item.id, item]));
  const metricRecords = records
    .filter(
      (record) =>
        classById.has(record.classId) &&
        record.date >= startDate &&
        record.date <= endDate &&
        (!studentId || record.studentId === studentId) &&
        (!membershipStatus ||
          membershipStatus === "all" ||
          studentById.get(record.studentId)?.membershipStatus === membershipStatus)
    )
    .sort((left, right) => {
      const byDate = left.date.localeCompare(right.date);
      if (byDate !== 0) return byDate;
      const leftClass = classById.get(left.classId)?.name ?? "";
      const rightClass = classById.get(right.classId)?.name ?? "";
      return leftClass.localeCompare(rightClass, "pt-BR");
    });
  const detailRecords = metricRecords.filter(
    (record) =>
      !attendanceStatus ||
      attendanceStatus === "all" ||
      record.status === attendanceStatus,
  );

  const details = detailRecords.map<AttendanceExportDetailRow>((record) => {
    const classGroup = classById.get(record.classId)!;
    const student = studentById.get(record.studentId);
    return {
      date: record.date,
      unit: classGroup.unit,
      className: classGroup.name,
      professorNames: getProfessorNames(classGroup.id),
      studentName: student?.name ?? "Aluno não localizado",
      membershipStatus: student
        ? student.membershipStatus === "inactive"
          ? "Inativo"
          : "Ativo"
        : "Não localizado",
      attendanceStatus: record.status === "presente" ? "Presente" : "Faltou",
    };
  });

  const summary = scopedClasses
    .map<AttendanceExportSummaryRow>((classGroup) => {
      const classRecords = metricRecords.filter((record) => record.classId === classGroup.id);
      const present = classRecords.filter((record) => record.status === "presente").length;
      const absent = classRecords.length - present;
      return {
        unit: classGroup.unit,
        className: classGroup.name,
        professorNames: getProfessorNames(classGroup.id),
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

  const totalPresent = metricRecords.filter((record) => record.status === "presente").length;
  const totalAbsent = metricRecords.length - totalPresent;

  return {
    details,
    summary,
    totalRecords: details.length,
    totalPresent,
    totalAbsent,
    attendanceRate: metricRecords.length
      ? Math.round((totalPresent / metricRecords.length) * 100)
      : 0,
  };
}

export function canAccessAttendanceExport(params: {
  roleLevel: number | null | undefined;
  reportsAllowed: boolean | null | undefined;
  permissionsLoading: boolean;
}) {
  if ((params.roleLevel ?? 0) >= 50) return true;
  return !params.permissionsLoading && params.reportsAllowed === true;
}

export function buildAttendanceExportFileParts(params: {
  scope: string;
  startDate: string;
  endDate: string;
  studentName?: string | null;
  professorName?: string | null;
  attendanceStatus?: AttendanceExportStatusFilter | null;
  membershipStatus?: AttendanceExportMembershipFilter | null;
}) {
  return [
    "chamadas",
    params.scope,
    params.professorName?.trim() || null,
    params.studentName?.trim() || null,
    params.attendanceStatus === "presente"
      ? "presencas"
      : params.attendanceStatus === "faltou"
        ? "faltas"
        : null,
    params.membershipStatus === "active"
      ? "ativos"
      : params.membershipStatus === "inactive"
        ? "inativos"
        : null,
    params.startDate,
    params.endDate,
  ].filter((part): part is string => Boolean(part));
}
