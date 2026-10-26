import { useEffect, useMemo, useState } from "react";

import type {
  ClassGroup,
  SessionLog,
  StudentScoutingLog,
} from "../../../core/models";
import {
  getClasses,
  getSessionLogsByRange,
  getStudentScoutingByRange,
} from "../../../db/seed";
import { getAttendanceExportStudents, type AttendanceExportStudent } from "../../../db/students";
import { measureAsync } from "../../../observability/perf";
import { getMonthlyAttendanceSummary, type AttendanceDailySummary } from "../../../db/attendance-summary";

type ReportTabId = "month" | "reports" | "students";

type UseTrainerReportsDataParams = {
  organizationId: string | null;
  month: Date;
  monthKey: string;
  classId: string;
  reportTab: ReportTabId;
  rangeBounds: { start: Date; end: Date };
};

export function useTrainerReportsData({
  organizationId,
  month,
  monthKey,
  classId,
  reportTab,
  rangeBounds,
}: UseTrainerReportsDataParams) {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const studentScope = useMemo(() => ({ organizationId, classId, enabled: reportTab === "students" }), [organizationId, classId, reportTab]);
  const [studentState, setStudentState] = useState<{ scope: typeof studentScope | null; rows: AttendanceExportStudent[]; error: string | null }>({ scope: null, rows: [], error: null });
  const baseScope = useMemo(() => ({ organizationId }), [organizationId]);
  const [loadedBaseScope, setLoadedBaseScope] = useState<typeof baseScope | null>(null);
  const attendanceScope = useMemo(() => ({ organizationId, monthKey }), [organizationId, monthKey]);
  const [attendanceState, setAttendanceState] = useState<{ scope: typeof attendanceScope | null; days: AttendanceDailySummary[]; error: string | null }>({ scope: null, days: [], error: null });
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [sessionState, setSessionState] = useState<{ scope: typeof attendanceScope | null; logs: SessionLog[]; error: string | null }>({ scope: null, logs: [], error: null });
  const scoutingStart = formatIsoDate(rangeBounds.start);
  const scoutingEnd = formatIsoDate(rangeBounds.end);
  const scoutingScope = useMemo(() => ({ organizationId, classId, enabled: reportTab === "students", scoutingStart, scoutingEnd }), [organizationId, classId, reportTab, scoutingStart, scoutingEnd]);
  const [scoutingState, setScoutingState] = useState<{ scope: typeof scoutingScope | null; rows: StudentScoutingLog[]; error: string | null }>({ scope: null, rows: [], error: null });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!organizationId) {
        setClasses([]);
        setLoadedBaseScope(baseScope);
        setLoadError(null);
        setLoadingBase(false);
        return;
      }
      try {
        setLoadError(null);
        const cls = await measureAsync(
          "screen.reportsTrainer.load.base",
          () => getClasses({ organizationId }),
          { screen: "reportsTrainer", organizationId }
        );
        if (!alive) return;
        setClasses(cls);
        setLoadedBaseScope(baseScope);
      } catch (error) {
        if (!alive) return;
        setClasses([]);
        setLoadedBaseScope(baseScope);
        setLoadError(error instanceof Error ? error.message : "Falha ao carregar relatórios.");
      } finally {
        if (alive) setLoadingBase(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [baseScope, organizationId]);

  useEffect(() => {
    let alive = true;
    if (!studentScope.enabled || !organizationId || !classId) return;
    void measureAsync("screen.reportsTrainer.load.highlightStudents", () => getAttendanceExportStudents({
      organizationId, classId, orderByName: true,
    }), { screen: "reportsTrainer", organizationId, classId }).then(rows => {
      if (alive) setStudentState({ scope: studentScope, rows, error: null });
    }).catch(error => {
      if (alive) setStudentState({ scope: studentScope, rows: [], error: error instanceof Error ? error.message : "Falha ao carregar atletas." });
    });
    return () => { alive = false; };
  }, [classId, organizationId, studentScope]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!organizationId) {
        setAttendanceState({ scope: attendanceScope, days: [], error: null });
        setLoadingAttendance(false);
        return;
      }
      try {
        setLoadingAttendance(true);
        const att = await measureAsync(
          "screen.reportsTrainer.load.attendance",
          () =>
            getMonthlyAttendanceSummary({
              organizationId,
              monthKey,
            }),
          {
            screen: "reportsTrainer",
            organizationId,
            month: monthKey,
          }
        );
        if (!alive) return;
        setAttendanceState({ scope: attendanceScope, days: att, error: null });
      } catch (error) {
        if (!alive) return;
        setAttendanceState({ scope: attendanceScope, days: [], error: error instanceof Error ? error.message : "Falha ao carregar presença." });
      } finally {
        if (alive) setLoadingAttendance(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [attendanceScope, monthKey, organizationId]);

  useEffect(() => {
    let alive = true;
    if (!organizationId) {
      Promise.resolve().then(() => {
        if (alive) setSessionState({ scope: attendanceScope, logs: [], error: null });
      });
      return () => {
        alive = false;
      };
    }
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    (async () => {
      const logs = await measureAsync(
        "screen.reportsTrainer.load.sessionLogs",
        () => getSessionLogsByRange(start.toISOString(), end.toISOString()),
        { screen: "reportsTrainer", month: monthKey }
      );
      if (!alive) return;
      setSessionState({ scope: attendanceScope, logs, error: null });
    })().catch((error) => {
      if (!alive) return;
      setSessionState({ scope: attendanceScope, logs: [], error: error instanceof Error ? error.message : "Falha ao carregar relatórios." });
    });
    return () => {
      alive = false;
    };
  }, [attendanceScope, month, monthKey, organizationId]);

  useEffect(() => {
    let alive = true;
    if (!scoutingScope.enabled || !organizationId || !classId) return;
    (async () => {
      const logs = await measureAsync(
        "screen.reportsTrainer.load.studentScouting",
        () => getStudentScoutingByRange(classId, scoutingStart, scoutingEnd),
        { screen: "reportsTrainer", classId, startKey: scoutingStart, endKey: scoutingEnd }
      );
      if (!alive) return;
      setScoutingState({ scope: scoutingScope, rows: logs, error: null });
    })().catch((error) => {
      if (!alive) return;
      setScoutingState({ scope: scoutingScope, rows: [], error: error instanceof Error ? error.message : "Falha ao carregar scouting." });
    });
    return () => {
      alive = false;
    };
  }, [classId, organizationId, scoutingStart, scoutingEnd, scoutingScope]);

  return {
    classes: loadedBaseScope === baseScope ? classes : [],
    students: studentState.scope === studentScope && studentScope.enabled ? studentState.rows : [],
    attendanceDays: attendanceState.scope === attendanceScope ? attendanceState.days : [],
    loading: loadingBase || loadingAttendance || loadedBaseScope !== baseScope || attendanceState.scope !== attendanceScope ||
      Boolean(studentScope.enabled && organizationId && classId && studentState.scope !== studentScope),
    sessionLogs: sessionState.scope === attendanceScope ? sessionState.logs : [],
    studentScoutingLogs: scoutingState.scope === scoutingScope && scoutingScope.enabled ? scoutingState.rows : [],
    loadError: (attendanceState.scope === attendanceScope ? attendanceState.error : null) ??
      (sessionState.scope === attendanceScope ? sessionState.error : null) ??
      (studentState.scope === studentScope && studentScope.enabled ? studentState.error : null) ??
      (scoutingState.scope === scoutingScope && scoutingScope.enabled ? scoutingState.error : null) ?? loadError,
  };
}

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatIsoDate = (value: Date) => {
  const y = value.getFullYear();
  const m = pad2(value.getMonth() + 1);
  const d = pad2(value.getDate());
  return `${y}-${m}-${d}`;
};
