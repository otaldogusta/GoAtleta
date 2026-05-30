import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AttendanceRecord,
  ClassCalendarException,
  ClassGroup,
  ClassPlan,
  DailyLessonPlan,
  PlanningCycle,
  SessionLog,
  Student,
} from "../../../core/models";
import { buildSessionCalendar, type PlannedSession } from "../../../core/session-calendar-engine";
import { ensureActiveCycleForYear, getActivePlanningCycle } from "../../../db/cycles";
import {
  getAttendanceByClass,
  getClassById,
  getClassCalendarExceptions,
  getClassPlansByClass,
  getSessionLogsByClass,
  getStudentsByClass,
  listDailyLessonPlansByWeekIds,
} from "../../../db/seed";
import type { WeekSessionPreview } from "../../periodization/application/build-week-session-preview";

export type WeeklyPlanningItem = {
  plan: ClassPlan;
  label: string;
  weekStartLabel: string;
  weekEndLabel: string;
  sessions: WeekSessionPreview[];
  skippedSessions: PlannedSession[];
};

export type DailyLessonPlanLookup = Record<string, DailyLessonPlan>;

const formatDatePt = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
};

const toMonthKey = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const toIsoDate = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return "";
};

const isWithinWindow = (date: string, startDate: string, endDate: string) =>
  Boolean(date && startDate && endDate && date >= startDate && date <= endDate);

const filterPlansByCycleWindow = (plans: ClassPlan[], options: {
  activeCycleId: string;
  startDate: string;
  endDate: string;
}) => {
  const { activeCycleId, startDate, endDate } = options;
  if (!startDate || !endDate) return plans;

  return plans.filter((plan) => {
    const planDate = toIsoDate(plan.startDate);
    if (!planDate) return false;
    const planCycleId = String(plan.cycleId ?? "").trim();

    if (activeCycleId && planCycleId === activeCycleId) return true;
    if (!planCycleId && isWithinWindow(planDate, startDate, endDate)) return true;
    return false;
  });
};

const dedupeWeeklyPlans = (plans: ClassPlan[]) => {
  const byWeek = new Map<string, ClassPlan>();
  for (const plan of plans) {
    const key = `${plan.weekNumber}|${toIsoDate(plan.startDate)}`;
    const existing = byWeek.get(key);
    if (!existing) {
      byWeek.set(key, plan);
      continue;
    }
    const currentUpdated = toIsoDate(plan.updatedAt || plan.createdAt);
    const existingUpdated = toIsoDate(existing.updatedAt || existing.createdAt);
    if (currentUpdated >= existingUpdated) {
      byWeek.set(key, plan);
    }
  }
  return [...byWeek.values()].sort((a, b) => a.weekNumber - b.weekNumber);
};

const toWeekSessionPreview = (session: PlannedSession, index: number): WeekSessionPreview => {
  const [year, month, day] = session.date.split("-");
  const weekdayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(new Date(`${session.date}T00:00:00`))
    .replace(".", "");
  return {
    sessionIndex: index + 1,
    weekday: session.weekday,
    weekdayLabel: weekdayLabel.charAt(0).toUpperCase() + weekdayLabel.slice(1),
    date: session.date,
    dateLabel: `${day}/${month}/${year}`,
    shortLabel: `${weekdayLabel} ${day}/${month}`,
  };
};

const buildWeeklyItemsWithCalendar = (
  plans: ClassPlan[],
  selectedClass: ClassGroup | null,
  calendarExceptions: ClassCalendarException[]
): WeeklyPlanningItem[] => {
  const daysOfWeek = selectedClass?.daysOfWeek ?? [];
  const weeklySessions = selectedClass?.daysPerWeek || daysOfWeek.length;

  return plans
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((plan) => {
      const weekStart = new Date(`${plan.startDate}T00:00:00`);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekEndIso = Number.isNaN(weekEnd.getTime())
        ? ""
        : `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;
      const calendar = selectedClass
        ? buildSessionCalendar({
            classGroup: {
              ...selectedClass,
              daysOfWeek,
              daysPerWeek: weeklySessions,
            },
            startDate: plan.startDate,
            endDate: weekEndIso,
            exceptions: calendarExceptions,
          })
        : { sessions: [], skippedSessions: [] };
      const sessions = calendar.sessions.map(toWeekSessionPreview);
      const skippedSessions = calendar.skippedSessions;
      if (!sessions.length && !skippedSessions.length && !selectedClass) {
        return {
          plan,
          sessions: [],
          skippedSessions: [],
          weekStartLabel: formatDatePt(plan.startDate),
          weekEndLabel: formatDatePt(plan.startDate),
          label: `Semana ${String(plan.weekNumber).padStart(2, "0")}`,
        };
      }
      if (!sessions.length && !skippedSessions.length && selectedClass) {
        const fallbackCalendar = buildSessionCalendar({
          classGroup: {
            ...selectedClass,
            daysOfWeek,
            daysPerWeek: weeklySessions,
          },
          startDate: plan.startDate,
          endDate: weekEndIso,
          exceptions: [],
        });
        const fallbackSessions = fallbackCalendar.sessions.map(toWeekSessionPreview);
        const weekStartLabel = fallbackSessions[0]?.dateLabel ?? formatDatePt(plan.startDate);
        const weekEndLabel = fallbackSessions[fallbackSessions.length - 1]?.dateLabel ?? formatDatePt(plan.startDate);
        return {
          plan,
          sessions: fallbackSessions,
          skippedSessions: [],
          weekStartLabel,
          weekEndLabel,
          label: `Semana ${String(plan.weekNumber).padStart(2, "0")}`,
        };
      }
      const weekStartLabel = sessions[0]?.dateLabel ?? formatDatePt(plan.startDate);
      const weekEndLabel = sessions[sessions.length - 1]?.dateLabel ?? formatDatePt(plan.startDate);

      return {
        plan,
        sessions,
        skippedSessions,
        weekStartLabel,
        weekEndLabel,
        label: `Semana ${String(plan.weekNumber).padStart(2, "0")}`,
      };
    });
};

export function useMonthlyPlans(classId: string, monthKey: string) {
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [activeCycle, setActiveCycle] = useState<PlanningCycle | null>(null);
  const [classPlans, setClassPlans] = useState<ClassPlan[]>([]);
  const [calendarExceptions, setCalendarExceptions] = useState<ClassCalendarException[]>([]);
  const [students, setStudents] = useState<Student[] | undefined>(undefined);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [recentSessionLogs, setRecentSessionLogs] = useState<SessionLog[]>([]);
  const [dailyPlansByKey, setDailyPlansByKey] = useState<DailyLessonPlanLookup>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!classId) {
      setSelectedClass(null);
      setActiveCycle(null);
      setClassPlans([]);
      setCalendarExceptions([]);
      setStudents(undefined);
      setRecentAttendance([]);
      setRecentSessionLogs([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cls = await getClassById(classId);
      const currentYear = new Date().getFullYear();
      const classStartDate = cls?.cycleStartDate || cls?.createdAt || null;
      await ensureActiveCycleForYear(classId, currentYear, classStartDate);
      const activeCycle = await getActivePlanningCycle(classId);
      const cycleYear = activeCycle?.year ?? null;
      const [
        plans,
        exceptions,
        classStudents,
        attendance,
        sessionLogs,
      ] = await Promise.all([
        getClassPlansByClass(classId, {
          cycleId: activeCycle?.id ?? null,
          cycleYear,
        }),
        getClassCalendarExceptions(classId, { organizationId: cls?.organizationId ?? null }).catch(() => []),
        getStudentsByClass(classId).catch(() => undefined),
        getAttendanceByClass(classId, { organizationId: cls?.organizationId ?? null }).catch(() => []),
        getSessionLogsByClass(classId, {
          organizationId: cls?.organizationId ?? null,
          limit: 12,
        }).catch(() => []),
      ]);

      const windowStart = toIsoDate(activeCycle?.startDate);
      const windowEnd = toIsoDate(activeCycle?.endDate);
      const scopedPlans = dedupeWeeklyPlans(
        filterPlansByCycleWindow(plans, {
          activeCycleId: String(activeCycle?.id ?? ""),
          startDate: windowStart,
          endDate: windowEnd,
        })
      );

      setSelectedClass(cls);
      setActiveCycle(activeCycle);
      setClassPlans(scopedPlans);
      setCalendarExceptions(exceptions);
      setStudents(classStudents);
      setRecentAttendance(attendance);
      setRecentSessionLogs(sessionLogs);

      const monthPlans = scopedPlans.filter((plan) => toMonthKey(plan.startDate) === monthKey);
      const weekIds = monthPlans.map((plan) => plan.id);
      const dailyPlans = await listDailyLessonPlansByWeekIds(weekIds);
      const mapped: DailyLessonPlanLookup = {};
      for (const plan of dailyPlans) {
        mapped[`${plan.weeklyPlanId}::${plan.date}`] = plan;
      }
      setDailyPlansByKey(mapped);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar o mês.");
    } finally {
      setIsLoading(false);
    }
  }, [classId, monthKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthPlans = useMemo(
    () => classPlans.filter((plan) => toMonthKey(plan.startDate) === monthKey),
    [classPlans, monthKey]
  );

  const weeklyItems = useMemo(
    () => buildWeeklyItemsWithCalendar(monthPlans, selectedClass, calendarExceptions),
    [calendarExceptions, monthPlans, selectedClass]
  );

  return {
    selectedClass,
    activeCycle,
    calendarExceptions,
    students,
    recentAttendance,
    recentSessionLogs,
    weeklyItems,
    dailyPlansByKey,
    isLoading,
    error,
    reload: load,
  };
}
