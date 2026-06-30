import type {
  AttendanceRecord,
  ClassGroup,
  SessionLog,
  Student,
  StudentScoutingLog,
} from "../../../core/models";
import {
  countsFromStudentLog,
  createEmptyCounts,
  getTechnicalPerformanceScore,
} from "../../../core/scouting";
import { simulateClassEvolution } from "../../../core/simulator/evolution-simulator";
import { buildTeamIntelligenceSnapshot } from "../../../api/reports";

export type AttendanceSummaryByClass = Record<string, { total: number; present: number }>;

export const formatTrainerReportDateLabel = (iso: string) => {
  const date = iso.split("T")[0];
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return parts.reverse().join("/");
};

const normalizeAttendanceRatio = (value: unknown) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  const ratio = parsed > 1 ? parsed / 100 : parsed;
  return Math.max(0, Math.min(1, ratio));
};

export function buildEntityMap<T extends { id: string }>(items: T[]) {
  const map: Record<string, T> = {};
  items.forEach((item) => {
    map[item.id] = item;
  });
  return map;
}

export function buildMonthAttendance(attendance: AttendanceRecord[], monthKey: string) {
  return attendance.filter((record) => record.date.startsWith(monthKey));
}

export function buildAttendanceSummaryByClass(
  monthAttendance: AttendanceRecord[]
): AttendanceSummaryByClass {
  const map: AttendanceSummaryByClass = {};
  monthAttendance.forEach((record) => {
    const current = map[record.classId] ?? { total: 0, present: 0 };
    current.total += 1;
    if (record.status === "presente") current.present += 1;
    map[record.classId] = current;
  });
  return map;
}

export function buildTrainerReportSummary(monthAttendance: AttendanceRecord[]) {
  const total = monthAttendance.length;
  const present = monthAttendance.filter((record) => record.status === "presente").length;
  const absent = total - present;
  const percent = total ? Math.round((present / total) * 100) : 0;
  return { total, present, absent, percent };
}

export function buildUniqueSessionLogs(sessionLogs: SessionLog[]) {
  const sorted = [...sessionLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unique: SessionLog[] = [];
  const seen = new Set<string>();

  sorted.forEach((log) => {
    const dateKey = log.createdAt.split("T")[0];
    const key = `${log.classId}_${dateKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(log);
  });

  return unique;
}

export function buildPseSummary(uniqueSessionLogs: SessionLog[]) {
  const valid = uniqueSessionLogs.filter((log) => typeof log.PSE === "number");
  if (!valid.length) {
    return { avg: null as number | null, total: 0 };
  }
  const sum = valid.reduce((acc, log) => acc + (log.PSE ?? 0), 0);
  return { avg: sum / valid.length, total: valid.length };
}

export function buildTrainerReportUnits(classes: ClassGroup[]) {
  const seen = new Set<string>();
  return classes
    .map((cls) => cls.unit || "Sem unidade")
    .filter((unit) => {
      if (seen.has(unit)) return false;
      seen.add(unit);
      return true;
    });
}

export function buildClassRows(
  classes: ClassGroup[],
  attendanceSummaryByClass: AttendanceSummaryByClass
) {
  return classes.map((cls) => {
    const classSummary = attendanceSummaryByClass[cls.id] ?? { total: 0, present: 0 };
    const total = classSummary.total;
    const present = classSummary.present;
    const percent = total ? Math.round((present / total) * 100) : 0;
    return { cls, total, present, percent };
  });
}

export function buildSessionLogRows(
  reportTab: string,
  uniqueSessionLogs: SessionLog[],
  classMap: Record<string, ClassGroup>
) {
  if (reportTab !== "reports") return [];
  return uniqueSessionLogs.map((log) => {
    const cls = classMap[log.classId];
    const className = cls?.name ?? "Turma";
    const dateKey = log.createdAt.split("T")[0];
    return {
      log,
      className,
      classGender: cls?.gender,
      dateKey,
      dateLabel: formatTrainerReportDateLabel(log.createdAt),
    };
  });
}

export function buildWeeklySummary(monthAttendance: AttendanceRecord[]) {
  const weeks = Array.from({ length: 5 }).map(() => ({ total: 0, present: 0 }));
  monthAttendance.forEach((record) => {
    const day = Number(record.date.slice(8, 10));
    const weekIndex = Math.min(Math.floor((day - 1) / 7), weeks.length - 1);
    weeks[weekIndex].total += 1;
    if (record.status === "presente") weeks[weekIndex].present += 1;
  });
  return weeks
    .map((week, index) => {
      const percent = week.total ? Math.round((week.present / week.total) * 100) : 0;
      return { label: `S${index + 1}`, percent, total: week.total };
    })
    .filter((week) => week.total > 0);
}

export function buildPerformanceRows({
  reportTab,
  classId,
  studentScoutingLogs,
  studentsForClass,
}: {
  reportTab: string;
  classId: string;
  studentScoutingLogs: StudentScoutingLog[];
  studentsForClass: Student[];
}) {
  if (reportTab !== "students") return [];
  if (!classId) return [];

  const countsByStudent: Record<string, ReturnType<typeof createEmptyCounts>> = {};
  studentScoutingLogs.forEach((log) => {
    if (!countsByStudent[log.studentId]) {
      countsByStudent[log.studentId] = createEmptyCounts();
    }
    const base = countsByStudent[log.studentId];
    const next = countsFromStudentLog(log);
    (Object.keys(base) as (keyof typeof base)[]).forEach((skill) => {
      base[skill][0] += next[skill][0];
      base[skill][1] += next[skill][1];
      base[skill][2] += next[skill][2];
    });
  });

  return studentsForClass
    .map((student) => {
      const counts = countsByStudent[student.id] ?? createEmptyCounts();
      const score = getTechnicalPerformanceScore(counts);
      return { student, score, counts };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildAvgPresenceByClass(classRows: { percent: number }[]) {
  if (!classRows.length) return null;
  const sum = classRows.reduce((acc, row) => acc + row.percent, 0);
  return sum / classRows.length;
}

export function buildTrainerTeamIntelligence(
  classes: ClassGroup[],
  uniqueSessionLogs: SessionLog[]
) {
  return buildTeamIntelligenceSnapshot({
    classes: classes.map((item) => ({ id: item.id, name: item.name, unit: item.unit })),
    sessionLogs: uniqueSessionLogs.map((item) => ({
      classId: item.classId,
      attendance: normalizeAttendanceRatio(item.attendance),
      PSE: Number(item.PSE || 0),
    })),
  });
}

export function buildSimulationHighlights(
  classes: ClassGroup[],
  uniqueSessionLogs: SessionLog[]
) {
  return classes
    .map((cls) => {
      const logs = uniqueSessionLogs
        .filter((item) => item.classId === cls.id)
        .slice(0, 8)
        .map((item) => ({
          ...item,
          attendance: normalizeAttendanceRatio(item.attendance),
        }));
      if (!logs.length) return null;
      const simulation = simulateClassEvolution({
        classId: cls.id,
        logs,
        horizonWeeks: 6,
        interventionIntensity: "balanced",
      });
      const lastPoint = simulation.points[simulation.points.length - 1];
      if (!lastPoint) return null;
      return {
        classId: cls.id,
        className: cls.name,
        baseline: simulation.baselineScore,
        projected: lastPoint.projectedScore,
        confidence: lastPoint.confidence,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.projected - a.projected)
    .slice(0, 5);
}
