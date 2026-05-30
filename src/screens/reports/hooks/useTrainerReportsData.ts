import { useEffect, useState } from "react";

import type {
  AttendanceRecord,
  ClassGroup,
  SessionLog,
  Student,
  StudentScoutingLog,
} from "../../../core/models";
import {
  getAttendanceAll,
  getClasses,
  getSessionLogsByRange,
  getStudentScoutingByRange,
  getStudents,
} from "../../../db/seed";
import { measureAsync } from "../../../observability/perf";

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
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [studentScoutingLogs, setStudentScoutingLogs] = useState<StudentScoutingLog[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!organizationId) {
        setClasses([]);
        setStudents([]);
        setLoadError(null);
        setLoadingBase(false);
        return;
      }
      try {
        setLoadError(null);
        const [cls, st] = await measureAsync(
          "screen.reportsTrainer.load.base",
          () =>
            Promise.all([
              getClasses({ organizationId }),
              getStudents({ organizationId }),
            ]),
          { screen: "reportsTrainer", organizationId }
        );
        if (!alive) return;
        setClasses(cls);
        setStudents(st);
      } catch (error) {
        if (!alive) return;
        setClasses([]);
        setStudents([]);
        setLoadError(error instanceof Error ? error.message : "Falha ao carregar relatórios.");
      } finally {
        if (alive) setLoadingBase(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [organizationId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!organizationId) {
        setAttendance([]);
        setLoadingAttendance(false);
        return;
      }
      try {
        setLoadingAttendance(true);
        const start = new Date(month.getFullYear(), month.getMonth(), 1);
        const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
        const att = await measureAsync(
          "screen.reportsTrainer.load.attendance",
          () =>
            getAttendanceAll({
              organizationId,
              startIso: start.toISOString(),
              endIso: end.toISOString(),
            }),
          {
            screen: "reportsTrainer",
            organizationId,
            month: monthKey,
          }
        );
        if (!alive) return;
        setAttendance(att);
      } catch (error) {
        if (!alive) return;
        setAttendance([]);
        setLoadError(error instanceof Error ? error.message : "Falha ao carregar presença.");
      } finally {
        if (alive) setLoadingAttendance(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [month, monthKey, organizationId]);

  useEffect(() => {
    let alive = true;
    if (!organizationId) {
      setSessionLogs([]);
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
      setSessionLogs(logs);
    })().catch((error) => {
      if (!alive) return;
      setSessionLogs([]);
      setLoadError(error instanceof Error ? error.message : "Falha ao carregar relatórios.");
    });
    return () => {
      alive = false;
    };
  }, [month, monthKey, organizationId]);

  useEffect(() => {
    let alive = true;
    if (reportTab !== "students") {
      setStudentScoutingLogs([]);
      return () => {
        alive = false;
      };
    }
    if (!classId) {
      setStudentScoutingLogs([]);
      return () => {
        alive = false;
      };
    }
    const startKey = formatIsoDate(rangeBounds.start);
    const endKey = formatIsoDate(rangeBounds.end);
    (async () => {
      const logs = await measureAsync(
        "screen.reportsTrainer.load.studentScouting",
        () => getStudentScoutingByRange(classId, startKey, endKey),
        { screen: "reportsTrainer", classId, startKey, endKey }
      );
      if (!alive) return;
      setStudentScoutingLogs(logs);
    })().catch((error) => {
      if (!alive) return;
      setStudentScoutingLogs([]);
      setLoadError(error instanceof Error ? error.message : "Falha ao carregar scouting.");
    });
    return () => {
      alive = false;
    };
  }, [classId, rangeBounds, reportTab]);

  return {
    classes,
    students,
    attendance,
    loading: loadingBase || loadingAttendance,
    sessionLogs,
    studentScoutingLogs,
    loadError,
  };
}

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatIsoDate = (value: Date) => {
  const y = value.getFullYear();
  const m = pad2(value.getMonth() + 1);
  const d = pad2(value.getDate());
  return `${y}-${m}-${d}`;
};
