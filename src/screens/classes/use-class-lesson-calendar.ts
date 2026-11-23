import { useEffect, useRef, useState } from "react";
import { listHolidayMakeups, type HolidayMakeup } from "../../api/holiday-makeups";
import { getClassCalendarExceptions } from "../../db/periodization";
import { isNetworkError } from "../../db/client";

type Calendar = {
  scope: string;
  paused: ReadonlyMap<string, string>;
  makeups: HolidayMakeup[];
  makeupDates: string[];
  pausesAvailable: boolean;
  status: "loading" | "ready" | "error";
  offline: boolean;
};

const emptyCalendar: Calendar = { scope: "", paused: new Map(), makeups: [], makeupDates: [], pausesAvailable: false, status: "loading", offline: false };

export function useClassLessonCalendar(scope: string, organizationId: string | null, classId: string, enabled: boolean) {
  const [calendar, setCalendar] = useState(emptyCalendar);
  const [attempt, setAttempt] = useState(0);
  const lastMakeups = useRef<{ scope: string; rows: HolidayMakeup[] } | null>(null);
  useEffect(() => {
    if (!organizationId || !classId || !enabled) return;
    let active = true;
    const assertCurrent = () => {
      if (!active) throw new Error("Calendário da turma alterado.");
    };
    void Promise.allSettled([
      getClassCalendarExceptions(classId, { organizationId, assertCurrent }),
      listHolidayMakeups(organizationId, classId),
    ]).then(([exceptions, makeups]) => {
      if (!active) return;
      const makeupOffline = makeups.status === "rejected" && isNetworkError(makeups.reason);
      const confirmedRows = makeups.status === "fulfilled" ? makeups.value.filter(row => row.classId === classId)
        : makeupOffline && lastMakeups.current?.scope === scope ? lastMakeups.current.rows : null;
      if (makeups.status === "fulfilled" && confirmedRows) lastMakeups.current = { scope, rows: confirmedRows };
      else if (!makeupOffline) lastMakeups.current = null;
      const rows = confirmedRows ?? [];
      const paused = new Map(exceptions.status === "fulfilled" ? exceptions.value.map(row => [row.date, row.reason]) : []);
      for (const row of rows) paused.set(row.originalDate, "Feriado");
      const pausesAvailable = exceptions.status === "fulfilled";
      setCalendar({ scope, paused, makeups: rows, makeupDates: rows.map(row => row.date), pausesAvailable,
        status: pausesAvailable && confirmedRows !== null ? "ready" : "error",
        offline: exceptions.status === "rejected" && isNetworkError(exceptions.reason) });
    });
    return () => { active = false; };
  }, [attempt, classId, enabled, organizationId, scope]);
  return {
    ...(calendar.scope === scope ? calendar : emptyCalendar),
    retry: () => { setCalendar(emptyCalendar); setAttempt(value => value + 1); },
  };
}
