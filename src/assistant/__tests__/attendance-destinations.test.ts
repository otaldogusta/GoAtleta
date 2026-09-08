import { attendanceDestinations } from "../attendance-destinations";
import type { AdminPendingAttendance } from "../../api/reports";
const row = (className: string, organizationId = "org-a") => ({ className, organizationId, classId: className, targetDate: "2026-09-07", unit: "Unidade", studentCount: 10, hasAttendanceToday: false });
const rows: AdminPendingAttendance[] = [row("Winx"), row("Ohayō"), row("Outra", "org-b")];
test("matches the named class from verified rows and preserves its actual date", () => {
  expect(attendanceDestinations("Registrar chamada pendente de Ohayo em 08/09", rows, "org-a")).toEqual([rows[1]]);
});
test("keeps multiple named classes for explicit selection", () => {
  expect(attendanceDestinations("Chamadas pendentes de Winx e Ohayō", rows, "org-a")).toEqual(rows.slice(0, 2));
});
test("never invents a destination or includes another organization", () => {
  expect(attendanceDestinations("classId=inventado", rows, "org-a")).toEqual(rows.slice(0, 2));
  expect(attendanceDestinations("Winx", rows, "org-c")).toEqual([]);
  expect(attendanceDestinations("Winx", [], "org-a")).toEqual([]);
});
