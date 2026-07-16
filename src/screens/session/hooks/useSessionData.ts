import { useCallback, useEffect, useState } from "react";

import type {
  ClassGroup,
  ClassPlan,
  DailyLessonPlan,
  KnowledgeSource,
  ScoutingLog,
  SessionLog,
  Student,
  TrainingPlan,
} from "../../../core/models";
import type { SessionMethodologyEvidence } from "../../../core/methodology/session-pedagogical-panel-language";
import type { SessionPlanningUpcomingEvent } from "../../../core/session-planning-context";
import {
  toScoutingPlanningSignal,
  type ScoutingPlanningSignal,
} from "../../../core/scouting";
import { listEvents } from "../../../api/events";
import {
  getAttendanceByDate,
  getClassById,
  getClassPlansByClass,
  getDailyLessonPlanByWeekAndDate,
  getKnowledgeRuleCitations,
  getKnowledgeSources,
  getLatestScoutingSessionDetailForPlanning,
  getScoutingLogByDate,
  getSessionLogByDate,
  getStudentsByClass,
  getTrainingPlans,
} from "../../../db/seed";
import { resolveClassPlanForSessionDate } from "../application/resolve-class-plan-for-session-date";

type UseSessionDataParams = {
  classId: string;
  sessionDate: string;
  weekdayId: number;
  scoutingMode: "treino" | "jogo";
  compactTrainingPlans: (plans: TrainingPlan[]) => TrainingPlan[];
};

export type SessionDataStatus = "loading" | "ready" | "not_found" | "error";

const getLatestFinalPlanForSession = async (
  organizationId: string | null,
  classId: string,
  sessionDateValue: string,
  weekdayValue: number
) => {
  const baseQuery = {
    organizationId,
    classId,
    status: "final" as const,
    orderBy: "version_desc" as const,
    limit: 1,
  };
  const byDate = await getTrainingPlans({
    ...baseQuery,
    applyDate: sessionDateValue,
  });
  if (byDate[0]) {
    return byDate[0];
  }
  const byWeekday = await getTrainingPlans({
    ...baseQuery,
    applyWeekday: weekdayValue,
  });
  return byWeekday[0] ?? null;
};

const buildEventWindow = (sessionDateValue: string, days = 14) => {
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(sessionDateValue)
    ? sessionDateValue
    : new Date().toISOString().slice(0, 10);
  const from = new Date(`${normalizedDate}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  };
};

export function useSessionData({
  classId,
  sessionDate,
  weekdayId,
  scoutingMode,
  compactTrainingPlans,
}: UseSessionDataParams) {
  const [reloadToken, setReloadToken] = useState(0);
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [savedClassPlans, setSavedClassPlans] = useState<TrainingPlan[]>([]);
  const [sessionStudents, setSessionStudents] = useState<Student[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingSessionExtras, setIsLoadingSessionExtras] = useState(true);
  const [sessionDataStatus, setSessionDataStatus] =
    useState<SessionDataStatus>("loading");
  const [sessionDataError, setSessionDataError] = useState<string | null>(null);
  const [sessionLog, setSessionLog] = useState<SessionLog | null>(null);
  const [scoutingLog, setScoutingLog] = useState<ScoutingLog | null>(null);
  const [scoutingSignal, setScoutingSignal] = useState<ScoutingPlanningSignal | null>(null);
  const [attendancePercent, setAttendancePercent] = useState<number | null>(null);
  const [currentClassPlan, setCurrentClassPlan] = useState<ClassPlan | null>(null);
  const [currentDailyLessonPlan, setCurrentDailyLessonPlan] =
    useState<DailyLessonPlan | null>(null);
  const [upcomingSessionEvents, setUpcomingSessionEvents] = useState<SessionPlanningUpcomingEvent[]>([]);
  const [isResolvingCurrentClassPlan, setIsResolvingCurrentClassPlan] = useState(false);
  const [methodologyEvidence, setMethodologyEvidence] =
    useState<SessionMethodologyEvidence | null>(null);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    setIsLoadingSession(true);
    setSessionDataStatus("loading");
    setSessionDataError(null);

    (async () => {
      try {
        const data = await getClassById(classId);
        if (alive) setCls(data);
        if (data) {
          const eventWindow = buildEventWindow(sessionDate);
          const [classStudents, currentPlan, classTrainingPlans, upcomingEvents] = await Promise.all([
            getStudentsByClass(data.id),
            getLatestFinalPlanForSession(
              data.organizationId ?? null,
              data.id,
              sessionDate,
              weekdayId
            ).catch(() => null),
            getTrainingPlans({
              organizationId: data.organizationId ?? null,
              classId: data.id,
              status: "final",
              orderBy: "createdat_desc",
              limit: 24,
            }).catch(() => [] as TrainingPlan[]),
            data.organizationId
              ? listEvents({
                  organizationId: data.organizationId,
                  fromIso: eventWindow.fromIso,
                  toIso: eventWindow.toIso,
                }).catch(() => [])
              : Promise.resolve([]),
          ]);
          const scopedEvents = upcomingEvents
            .filter((event) => {
              const classScoped = event.classIds.includes(data.id);
              const unitScoped =
                !event.classIds.length && Boolean(data.unitId && event.unitId === data.unitId);
              return classScoped || unitScoped;
            })
            .slice(0, 3)
            .map((event) => ({
              title: event.title,
              date: String(event.startsAt ?? "").slice(0, 10),
              classScoped: event.classIds.includes(data.id),
            }));
          if (alive) {
            setSessionStudents(classStudents);
            setSavedClassPlans(compactTrainingPlans(classTrainingPlans));
            setPlan(currentPlan);
            setUpcomingSessionEvents(scopedEvents);
            setSessionDataStatus("ready");
            setSessionDataError(null);
          }
          if (!alive) return;
        } else if (alive) {
          setSavedClassPlans([]);
          setSessionStudents([]);
          setPlan(null);
          setUpcomingSessionEvents([]);
          setSessionLog(null);
          setScoutingLog(null);
          setScoutingSignal(null);
          setSessionDataStatus("not_found");
          setSessionDataError(null);
          return;
        }

        if (classId) {
          const [log, scouting, richScouting] = await Promise.all([
            getSessionLogByDate(classId, sessionDate),
            getScoutingLogByDate(classId, sessionDate, scoutingMode),
            getLatestScoutingSessionDetailForPlanning(classId, sessionDate, {
              organizationId: data?.organizationId ?? null,
            }).catch(() => null),
          ]);
          if (alive) {
            setSessionLog(log);
            setScoutingLog(scouting);
            setScoutingSignal(
              richScouting?.actions.length
                ? toScoutingPlanningSignal(richScouting.actions)
                : null
            );
          }
        }
      } catch {
        if (alive) {
          setSavedClassPlans([]);
          setSessionStudents([]);
          setPlan(null);
          setUpcomingSessionEvents([]);
          setSessionLog(null);
          setScoutingLog(null);
          setScoutingSignal(null);
          setSessionDataStatus("error");
          setSessionDataError("Nao foi possivel carregar a aula do dia.");
        }
      } finally {
        if (alive) setIsLoadingSession(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [classId, compactTrainingPlans, reloadToken, scoutingMode, sessionDate, weekdayId]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentClassPlan = async () => {
      if (!cls) {
        setCurrentClassPlan(null);
        setIsResolvingCurrentClassPlan(false);
        return;
      }
      setIsResolvingCurrentClassPlan(true);
      try {
        const plans = await getClassPlansByClass(cls.id, {
          organizationId: cls.organizationId ?? null,
        });
        if (cancelled) return;
        setCurrentClassPlan(resolveClassPlanForSessionDate(plans, sessionDate));
      } catch {
        if (!cancelled) setCurrentClassPlan(null);
      } finally {
        if (!cancelled) setIsResolvingCurrentClassPlan(false);
      }
    };

    void loadCurrentClassPlan();

    return () => {
      cancelled = true;
    };
  }, [cls?.id, cls?.organizationId, reloadToken, sessionDate]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentDailyLessonPlan = async () => {
      if (!currentClassPlan?.id) {
        setCurrentDailyLessonPlan(null);
        return;
      }

      try {
        const dailyPlan = await getDailyLessonPlanByWeekAndDate(
          currentClassPlan.id,
          sessionDate
        );
        if (!cancelled) {
          setCurrentDailyLessonPlan(dailyPlan);
        }
      } catch {
        if (!cancelled) {
          setCurrentDailyLessonPlan(null);
        }
      }
    };

    void loadCurrentDailyLessonPlan();

    return () => {
      cancelled = true;
    };
  }, [currentClassPlan?.id, reloadToken, sessionDate]);

  useEffect(() => {
    let cancelled = false;

    const loadMethodologyEvidence = async () => {
      const methodology = plan?.pedagogy?.methodology;
      const kbRuleKey = methodology?.kbRuleKey?.trim();
      const knowledgeBaseVersionId = methodology?.reasoning?.knowledgeBaseVersionId?.trim();
      if (!kbRuleKey || !knowledgeBaseVersionId) {
        setMethodologyEvidence(null);
        return;
      }

      try {
        const citations = await getKnowledgeRuleCitations({ knowledgeRuleId: kbRuleKey });
        const sourceIds = citations
          .map((citation) => citation.knowledgeSourceId ?? "")
          .filter(Boolean);
        if (!sourceIds.length) {
          if (!cancelled) setMethodologyEvidence(null);
          return;
        }

        const sources = await getKnowledgeSources({ knowledgeBaseVersionId });
        const sourceById = new Map(sources.map((source) => [source.id, source] as const));
        const firstSource = sourceIds
          .map((sourceId) => sourceById.get(sourceId))
          .find((source): source is KnowledgeSource => Boolean(source));
        const firstCitation = citations.find(
          (citation) => citation.knowledgeSourceId === firstSource?.id
        );

        if (!cancelled) {
          setMethodologyEvidence(
            firstSource
              ? {
                  title: firstSource.title,
                  authors: firstSource.authors,
                  sourceYear: firstSource.sourceYear ?? null,
                  citationText:
                    firstCitation?.evidence || firstSource.citationText || firstSource.title,
                  url: firstSource.sourceUrl,
                }
              : null
          );
        }
      } catch {
        if (!cancelled) setMethodologyEvidence(null);
      }
    };

    void loadMethodologyEvidence();

    return () => {
      cancelled = true;
    };
  }, [
    plan?.pedagogy?.methodology?.kbRuleKey,
    plan?.pedagogy?.methodology?.reasoning?.knowledgeBaseVersionId,
    reloadToken,
  ]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoadingSessionExtras(true);
      try {
        if (!classId) return;
        const attendanceRecords = await getAttendanceByDate(classId, sessionDate);
        if (!alive) return;
        if (attendanceRecords.length) {
          const present = attendanceRecords.filter(
            (record) => record.status === "presente"
          ).length;
          const total = attendanceRecords.length;
          const percent = total > 0 ? Math.round((present / total) * 100) : 0;
          setAttendancePercent(percent);
        } else if (sessionStudents.length > 0) {
          setAttendancePercent(0);
        } else {
          setAttendancePercent(null);
        }
      } catch {
        if (alive) setAttendancePercent(null);
      } finally {
        if (alive) setIsLoadingSessionExtras(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [classId, reloadToken, sessionDate, sessionStudents.length]);

  return {
    cls,
    setCls,
    plan,
    setPlan,
    savedClassPlans,
    setSavedClassPlans,
    sessionStudents,
    setSessionStudents,
    studentsCount: sessionStudents.length,
    isLoadingSession,
    isLoadingSessionExtras,
    sessionDataStatus,
    sessionDataError,
    sessionLog,
    setSessionLog,
    scoutingLog,
    setScoutingLog,
    scoutingSignal,
    attendancePercent,
    currentClassPlan,
    currentDailyLessonPlan,
    setCurrentDailyLessonPlan,
    upcomingSessionEvents,
    isResolvingCurrentClassPlan,
    methodologyEvidence,
    reload,
  };
}
