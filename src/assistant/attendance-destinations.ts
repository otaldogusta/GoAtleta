import type { AdminPendingAttendance } from "../api/reports";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function attendanceDestinations(text: string, rows: AdminPendingAttendance[], organizationId: string) {
  const eligible = rows.filter(row => row.organizationId === organizationId && row.classId && /^\d{4}-\d{2}-\d{2}$/.test(row.targetDate));
  const prose = ` ${normalize(text)} `;
  const mentioned = eligible.filter(row => normalize(row.className) && prose.includes(` ${normalize(row.className)} `));
  return mentioned.length ? mentioned : eligible;
}
