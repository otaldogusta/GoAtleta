import type { AttendanceExportDetailRow, AttendanceExportSummaryRow } from "./attendance-export";

/** Group by stable class identity, then calendar month; never mix same-name classes. */
export function groupAttendanceExportDetails(details: AttendanceExportDetailRow[]) {
  const classes = new Map<string, { key: string; unit: string; className: string; months: { key: string; label: string; rows: AttendanceExportDetailRow[] }[] }>();
  const sorted = [...details].sort((a, b) =>
    a.unit.localeCompare(b.unit, "pt-BR") || a.className.localeCompare(b.className, "pt-BR") ||
    (a.classId ?? "").localeCompare(b.classId ?? "") || a.date.localeCompare(b.date) ||
    a.studentName.localeCompare(b.studentName, "pt-BR"));
  for (const row of sorted) {
    const key = row.classId ?? JSON.stringify([row.unit, row.className]);
    let group = classes.get(key);
    if (!group) {
      group = { key, unit: row.unit, className: row.className, months: [] };
      classes.set(key, group);
    }
    const monthKey = row.date.slice(0, 7);
    let month = group.months[group.months.length - 1];
    if (!month || month.key !== monthKey) {
      const [year, monthNumber] = monthKey.split("-");
      const name = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][Number(monthNumber) - 1];
      month = { key: monthKey, label: `${name} de ${year}`, rows: [] };
      group.months.push(month);
    }
    month.rows.push(row);
  }
  return [...classes.values()];
}


export function buildAttendanceExportDetailSheets(details: AttendanceExportDetailRow[]) {
  return groupAttendanceExportDetails(details).map((group, index) => ({
    name: `${index + 1} ${group.className}`.replace(/[\\/?*\[\]:]/g, " ").slice(0, 31),
    rows: [
      ["Mês", "Data", "Unidade", "Turma", "Professor", "Atleta", "Vínculo", "Presença", "Horário", "Dias", "Faixa etária", "Nível", "Grupo", "Local"],
      ...group.months.flatMap((month) => month.rows.map((row) => [
        month.label, row.date.split("-").reverse().join("/"), row.unit, row.className,
        row.professorNames, row.studentName, row.membershipStatus, row.attendanceStatus,
        row.classInfo?.scheduleLabel ?? "", row.classInfo?.daysLabel ?? "",
        row.classInfo?.ageBandLabel ?? "", row.classInfo?.levelLabel ?? "",
        row.classInfo?.genderLabel ?? "", row.classInfo?.trainingSpace ?? "",
      ])),
    ],
    options: { freezeHeaderRow: true, autoFilterHeaderRow: true, autoSizeColumns: true },
  }));
}


/** Bounded PDF pages keep the whole class/month together and repeat context on continuation. */
export function buildAttendanceMonthlyPages(details: AttendanceExportDetailRow[]) {
  return groupAttendanceExportDetails(details).flatMap((group, groupIndex, groups) =>
    group.months.flatMap((month) => {
      const dates = [...new Set(month.rows.map((row) => row.date))].sort();
      const athletes = new Map<string, { key: string; name: string; membership: string; statuses: Map<string, string[]>; present: number; absent: number }>();
      for (const row of month.rows) {
        const key = row.studentId ?? JSON.stringify([row.studentName, row.membershipStatus]);
        let athlete = athletes.get(key);
        if (!athlete) {
          athlete = { key, name: row.studentName, membership: row.membershipStatus, statuses: new Map(), present: 0, absent: 0 };
          athletes.set(key, athlete);
        }
        const marks = athlete.statuses.get(row.date) ?? [];
        marks.push(row.attendanceStatus === "Presente" ? "P" : "F");
        athlete.statuses.set(row.date, marks);
        if (row.attendanceStatus === "Presente") athlete.present++;
        else athlete.absent++;
      }
      const rows = [...athletes.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.key.localeCompare(b.key));
      const present = month.rows.filter((row) => row.attendanceStatus === "Presente").length;
      const absent = month.rows.length - present;
      const dateParts = Math.ceil(dates.length / 12);
      const rowGroups: (typeof rows)[] = [];
      let rowBudget = 0;
      for (const row of rows) {
        // Reserve extra line space for long names instead of truncating them.
        const weight = Math.max(1, Math.ceil(row.name.length / 35));
        if (!rowGroups.length || rowBudget + weight > 17) {
          rowGroups.push([]);
          rowBudget = 0;
        }
        rowGroups[rowGroups.length - 1].push(row);
        rowBudget += weight;
      }
      const rowParts = rowGroups.length;
      const pages = [];
      for (let datePart = 0; datePart < dateParts; datePart++) {
        for (let rowPart = 0; rowPart < rowParts; rowPart++) {
          pages.push({
            key: `${group.key}-${month.key}-${datePart}-${rowPart}`,
            className: group.className, unit: group.unit,
            classInfo: month.rows[0].classInfo,
            professorNames: month.rows[0].professorNames,
            groupNumber: groupIndex + 1, groupCount: groups.length,
            monthLabel: month.label, monthKey: month.key,
            dates: dates.slice(datePart * 12, (datePart + 1) * 12),
            athletes: rowGroups[rowPart],
            athleteOffset: rowGroups.slice(0, rowPart).reduce((sum, part) => sum + part.length, 0),
            athleteCount: rows.length, sessionCount: dates.length,
            recordCount: month.rows.length,
            present, absent,
            part: datePart * rowParts + rowPart + 1, parts: dateParts * rowParts,
          });
        }
      }
      return pages;
    }));
}


export function paginateAttendanceSummary(rows: AttendanceExportSummaryRow[]) {
  return Array.from({ length: Math.max(1, Math.ceil(rows.length / 9)) }, (_, index) => rows.slice(index * 9, (index + 1) * 9));
}
