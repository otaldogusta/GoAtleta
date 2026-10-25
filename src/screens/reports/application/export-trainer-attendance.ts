import { assertSessionIdentity, getSessionIdentity, SessionIdentityChangedError } from "../../../auth/session";
import { getActiveOrganizationId, getReadCacheGeneration } from "../../../db/client";
import { getAttendanceAll, getAttendanceExportStudents } from "../../../db/students";
import { REPORT_ATTENDANCE_EXPORT_HEADERS_PTBR } from "../../../utils/export-schemas";
import { exportWorkbookXlsx } from "../../../utils/export-xlsx";
import { buildMonthAttendance } from "./trainer-report-selectors";

export async function exportTrainerAttendance(input: {
  organizationId: string;
  monthKey: string;
  classNames: Record<string, string>;
  isCurrent: () => boolean;
}) {
  const identity = getSessionIdentity();
  const generation = getReadCacheGeneration();
  const assertCurrent = () => {
    assertSessionIdentity(identity);
    if (!input.isCurrent() || generation !== getReadCacheGeneration()) throw new SessionIdentityChangedError();
  };
  assertCurrent();
  const initialOrganizationId = await getActiveOrganizationId();
  assertCurrent();
  const start = `${input.monthKey}-01`;
  const nextMonth = new Date(`${start}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const records = await getAttendanceAll({
    organizationId: input.organizationId,
    // attendance_logs.date is DATE. Match the summary's civil month even in
    // positive-offset time zones, where local midnight ISO is the previous day.
    startIso: start,
    endIso: nextMonth.toISOString().slice(0, 10),
  });
  assertCurrent();
  const students = await getAttendanceExportStudents({ organizationId: input.organizationId });
  const currentOrganizationId = await getActiveOrganizationId();
  assertCurrent();
  if (currentOrganizationId !== initialOrganizationId) throw new SessionIdentityChangedError();
  const studentNames = Object.fromEntries(students.map(student => [student.id, student.name]));
  const rows = [
    [...REPORT_ATTENDANCE_EXPORT_HEADERS_PTBR],
    ...buildMonthAttendance(records, input.monthKey).map(record => [
      record.date, input.classNames[record.classId] ?? "", studentNames[record.studentId] ?? "", record.status, record.note ?? "",
    ]),
  ];
  assertCurrent();
  return exportWorkbookXlsx({
    fileName: `relatorio_${input.monthKey}.xlsx`,
    sheets: [{ name: "Relatorio", rows, options: {
      freezeHeaderRow: true, autoFilterHeaderRow: true, autoSizeColumns: true,
      columnWidths: [12, 24, 28, 14, 42], minColumnWidth: 10, maxColumnWidth: 48,
    } }],
    dialogTitle: "Exportar relatório",
    assertCurrent,
  });
}
