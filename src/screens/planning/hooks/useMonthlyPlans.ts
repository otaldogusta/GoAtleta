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
import type { PlannedSession } from "../../../core/session-calendar-engine";
import { isClassPeriodizationConfigured } from "../../../core/periodization-policy";
import {
  getOrCreateInitialActivePlanningCycle,
} from "../../../db/cycles";
import {
  listActiveStudentContextsByClass,
  type ActiveStudentContext,
} from "../../../db/student-context-events";
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
import {
  buildPlanSessionCalendar,
  filterClassPlansBySessionMonth,
} from "../application/monthly-plan-calendar";
import {
  buildProfessorAgendaEvents,
  buildProfessorMonthCalendar,
} from "../application/professor-agenda-events";
import { resolvePlanningCycleForMonth } from "../application/planning-cycle-selection";

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
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
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

const REQUIRED_MONTHLY_DATA_TIMEOUT_MS = 10000;
const OPTIONAL_MONTHLY_DATA_TIMEOUT_MS = 6000;

const loadRequiredMonthlyData = async <T>(
  label: string,
  promise: Promise<T>,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Tempo excedido ao carregar ${label}.`));
    }, REQUIRED_MONTHLY_DATA_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const loadOptionalMonthlyData = async <T>(
  label: string,
  promise: Promise<T>,
  fallback: T,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`Monthly planning optional data timed out: ${label}`);
      resolve(fallback);
    }, OPTIONAL_MONTHLY_DATA_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    console.warn(`Monthly planning optional data failed: ${label}`, error);
    return fallback;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const filterPlansByCycleWindow = (
  plans: ClassPlan[],
  options: {
    activeCycleId: string;
    startDate: string;
    endDate: string;
  },
) => {
  const { activeCycleId, startDate, endDate } = options;
  if (!startDate || !endDate) return plans;

  return plans.filter((plan) => {
    const planDate = toIsoDate(plan.startDate);
    if (!planDate) return false;
    const planCycleId = String(plan.cycleId ?? "").trim();

    if (activeCycleId && planCycleId === activeCycleId) return true;
    if (!planCycleId && isWithinWindow(planDate, startDate, endDate))
      return true;
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

const toWeekSessionPreview = (
  session: PlannedSession,
  index: number,
): WeekSessionPreview => {
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
  calendarExceptions: ClassCalendarException[],
  monthKey?: string,
): WeeklyPlanningItem[] => {
  return plans
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((plan) => {
      const calendar = selectedClass
        ? buildPlanSessionCalendar({
            plan,
            classGroup: selectedClass,
            exceptions: calendarExceptions,
            monthKey,
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
        const fallbackCalendar = buildPlanSessionCalendar({
          plan,
          classGroup: selectedClass,
          exceptions: [],
          monthKey,
        });
        const fallbackSessions =
          fallbackCalendar.sessions.map(toWeekSessionPreview);
        const weekStartLabel =
          fallbackSessions[0]?.dateLabel ?? formatDatePt(plan.startDate);
        const weekEndLabel =
          fallbackSessions[fallbackSessions.length - 1]?.dateLabel ??
          formatDatePt(plan.startDate);
        return {
          plan,
          sessions: fallbackSessions,
          skippedSessions: [],
          weekStartLabel,
          weekEndLabel,
          label: `Semana ${String(plan.weekNumber).padStart(2, "0")}`,
        };
      }
      const weekStartLabel =
        sessions[0]?.dateLabel ?? formatDatePt(plan.startDate);
      const weekEndLabel =
        sessions[sessions.length - 1]?.dateLabel ??
        formatDatePt(plan.startDate);

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
  const [calendarExceptions, setCalendarExceptions] = useState<
    ClassCalendarException[]
  >([]);
  const [students, setStudents] = useState<Student[] | undefined>(undefined);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>(
    [],
  );
  const [recentSessionLogs, setRecentSessionLogs] = useState<SessionLog[]>([]);
  const [studentContexts, setStudentContexts] = useState<
    ActiveStudentContext[]
  >([]);
  const [dailyPlansByKey, setDailyPlansByKey] = useState<DailyLessonPlanLookup>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);
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
      setStudentContexts([]);
      setDailyPlansByKey({});
      setError(null);
      setIsLoading(false);
      setHasCompletedInitialLoad(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cls = await loadRequiredMonthlyData(
        "dados da turma",
        getClassById(classId),
      );
      if (!cls?.organizationId) {
        throw new Error("Turma sem workspace ativo.");
      }
      setSelectedClass(cls);

      if (!isClassPeriodizationConfigured(cls)) {
        setActiveCycle(null);
        setClassPlans([]);
        setCalendarExceptions([]);
        setStudents(undefined);
        setRecentAttendance([]);
        setRecentSessionLogs([]);
        setStudentContexts([]);
        setDailyPlansByKey({});
        return;
      }
      const classStartDate = cls?.cycleStartDate || cls?.createdAt || null;
      const requestedYear = Number.parseInt(monthKey.slice(0, 4), 10);
      const configuredYear = Number.parseInt(
        String(classStartDate ?? "").slice(0, 4),
        10,
      );
      const initialCycleYear = Number.isFinite(configuredYear)
        ? configuredYear
        : Number.isFinite(requestedYear)
          ? requestedYear
          : new Date().getFullYear();
      const cycleResult = await loadRequiredMonthlyData(
        "ciclo ativo",
        getOrCreateInitialActivePlanningCycle(
          classId,
          cls.organizationId,
          initialCycleYear,
          classStartDate,
        ),
      );
      const selectedCycle = resolvePlanningCycleForMonth(
        cycleResult.cycles,
        cycleResult.activeCycle,
        monthKey,
      );
      if (!selectedCycle) {
        setActiveCycle(null);
        setClassPlans([]);
        setCalendarExceptions([]);
        setStudents(undefined);
        setRecentAttendance([]);
        setRecentSessionLogs([]);
        setStudentContexts([]);
        setDailyPlansByKey({});
        return;
      }
      const cycleYear = selectedCycle.year;
      const plans = await loadRequiredMonthlyData(
        "semanas do ciclo",
        getClassPlansByClass(classId, {
          cycleId: selectedCycle.id,
          cycleYear,
        }),
      );

      const windowStart = toIsoDate(selectedCycle.startDate);
      const windowEnd = toIsoDate(selectedCycle.endDate);
      const scopedPlans = dedupeWeeklyPlans(
        filterPlansByCycleWindow(plans, {
          activeCycleId: selectedCycle.id,
          startDate: windowStart,
          endDate: windowEnd,
        }),
      );

      // A turma, o ciclo e as semanas formam a carga crítica da tela. Os
      // contextos auxiliares enriquecem o planejamento, mas não devem manter
      // o usuário preso no shimmer enquanto chegam.
      setActiveCycle(selectedCycle);
      setClassPlans(scopedPlans);
      setHasCompletedInitialLoad(true);

      const [exceptions, classStudents, attendance, sessionLogs, contexts] =
        await Promise.all([
          loadOptionalMonthlyData(
            "calendar exceptions",
            getClassCalendarExceptions(classId, {
              organizationId: cls?.organizationId ?? null,
            }),
            [],
          ),
          loadOptionalMonthlyData(
            "students",
            getStudentsByClass(classId),
            undefined,
          ),
          loadOptionalMonthlyData(
            "attendance",
            getAttendanceByClass(classId, {
              organizationId: cls?.organizationId ?? null,
            }),
            [],
          ),
          loadOptionalMonthlyData(
            "session logs",
            getSessionLogsByClass(classId, {
              organizationId: cls?.organizationId ?? null,
              limit: 12,
            }),
            [],
          ),
          loadOptionalMonthlyData(
            "student contexts",
            listActiveStudentContextsByClass(classId),
            [],
          ),
        ]);

      setCalendarExceptions(exceptions);
      setStudents(classStudents);
      setRecentAttendance(attendance);
      setRecentSessionLogs(sessionLogs);
      setStudentContexts(contexts);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Falha ao carregar o mês.",
      );
    } finally {
      setIsLoading(false);
      setHasCompletedInitialLoad(true);
    }
  }, [classId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void load();
    });
  }, [load]);

  // Carregamento incremental sob demanda de planos diários ao alternar de mês (sem travar a tela)
  useEffect(() => {
    if (!selectedClass || !classPlans.length || !monthKey) return;
    const currentMonthPlans = filterClassPlansBySessionMonth(
      classPlans,
      selectedClass,
      calendarExceptions,
      monthKey,
    );
    const weekIds = currentMonthPlans.map((plan) => plan.id);
    if (!weekIds.length) return;

    let isMounted = true;
    listDailyLessonPlansByWeekIds(weekIds)
      .then((dailyPlans) => {
        if (!isMounted || !dailyPlans.length) return;
        setDailyPlansByKey((prev) => {
          let hasNew = false;
          const next = { ...prev };
          for (const plan of dailyPlans) {
            const key = `${plan.weeklyPlanId}::${plan.date}`;
            if (!next[key]) {
              next[key] = plan;
              hasNew = true;
            }
          }
          return hasNew ? next : prev;
        });
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [calendarExceptions, classPlans, monthKey, selectedClass]);

  const monthPlans = useMemo(
    () =>
      filterClassPlansBySessionMonth(
        classPlans,
        selectedClass,
        calendarExceptions,
        monthKey,
      ),
    [calendarExceptions, classPlans, monthKey, selectedClass],
  );

  const weeklyItems = useMemo(
    () =>
      buildWeeklyItemsWithCalendar(
        monthPlans,
        selectedClass,
        calendarExceptions,
        monthKey,
      ),
    [calendarExceptions, monthKey, monthPlans, selectedClass],
  );
  const agendaEvents = useMemo(
    () =>
      buildProfessorAgendaEvents({
        weeklyItems,
        dailyPlansByKey,
        classGroup: selectedClass ?? undefined,
        calendarExceptions,
      }),
    [calendarExceptions, dailyPlansByKey, selectedClass, weeklyItems],
  );
  const monthCalendarDays = useMemo(
    () => buildProfessorMonthCalendar({ monthKey, events: agendaEvents }),
    [agendaEvents, monthKey],
  );

  return {
    selectedClass,
    activeCycle,
    calendarExceptions,
    students,
    recentAttendance,
    recentSessionLogs,
    studentContexts,
    classPlans,
    weeklyItems,
    agendaEvents,
    monthCalendarDays,
    dailyPlansByKey,
    isPeriodizationConfigured: isClassPeriodizationConfigured(selectedClass),
    isHistoricalCycle: activeCycle?.status === "archived",
    isInitialLoading: !hasCompletedInitialLoad,
    isLoading,
    error,
    reload: load,
  };
}
