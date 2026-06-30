import {
  buildAttendanceSummaryByClass,
  buildMonthAttendance,
  buildPerformanceRows,
  buildTrainerTeamIntelligence,
  buildTrainerReportSummary,
  buildUniqueSessionLogs,
  buildWeeklySummary,
} from "../trainer-report-selectors";
import type {
  AttendanceRecord,
  ClassGroup,
  SessionLog,
  Student,
  StudentScoutingLog,
} from "../../../../core/models";

describe("trainer-report-selectors", () => {
  it("summarizes monthly attendance without mixing months", () => {
    const records = [
      { id: "a1", classId: "c1", studentId: "s1", date: "2026-05-01", status: "presente" },
      { id: "a2", classId: "c1", studentId: "s2", date: "2026-05-01", status: "falta" },
      { id: "a3", classId: "c2", studentId: "s3", date: "2026-06-01", status: "presente" },
    ] as AttendanceRecord[];

    const monthAttendance = buildMonthAttendance(records, "2026-05");

    expect(buildTrainerReportSummary(monthAttendance)).toEqual({
      total: 2,
      present: 1,
      absent: 1,
      percent: 50,
    });
    expect(buildAttendanceSummaryByClass(monthAttendance)).toEqual({
      c1: { total: 2, present: 1 },
    });
  });

  it("keeps only the latest session log per class and date", () => {
    const logs = [
      { id: "old", classId: "c1", createdAt: "2026-05-01T08:00:00.000Z" },
      { id: "new", classId: "c1", createdAt: "2026-05-01T10:00:00.000Z" },
      { id: "other", classId: "c1", createdAt: "2026-05-02T10:00:00.000Z" },
    ] as SessionLog[];

    expect(buildUniqueSessionLogs(logs).map((log) => log.id)).toEqual(["other", "new"]);
  });

  it("normalizes session attendance percentages for team intelligence", () => {
    const snapshot = buildTrainerTeamIntelligence(
      [{ id: "c1", name: "Turma 10-12", unit: "Rede Esportes" }] as ClassGroup[],
      [{ id: "log1", classId: "c1", attendance: 67, PSE: 5, createdAt: "2026-05-01T10:00:00.000Z" }] as SessionLog[]
    );

    expect(snapshot.globalAvgAttendance).toBeCloseTo(0.67);
    expect(snapshot.rankingByAttendance[0]?.avgAttendance).toBeCloseTo(0.67);
  });

  it("builds weekly summary for weeks with data", () => {
    const records = [
      { id: "a1", classId: "c1", studentId: "s1", date: "2026-05-01", status: "presente" },
      { id: "a2", classId: "c1", studentId: "s2", date: "2026-05-08", status: "falta" },
    ] as AttendanceRecord[];

    expect(buildWeeklySummary(records)).toEqual([
      { label: "S1", percent: 100, total: 1 },
      { label: "S2", percent: 0, total: 1 },
    ]);
  });

  it("returns empty performance rows outside the students tab", () => {
    const students = [{ id: "s1", name: "Ana" }] as Student[];
    const scouting = [{ id: "log1", studentId: "s1" }] as StudentScoutingLog[];

    expect(
      buildPerformanceRows({
        reportTab: "month",
        classId: "c1",
        studentsForClass: students,
        studentScoutingLogs: scouting,
      })
    ).toEqual([]);
  });
});
