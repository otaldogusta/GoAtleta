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
import {
  getAttendanceByDate,
  getClassById,
  getClassPlansByClass,
  getDailyLessonPlanByWeekAndDate,
  getKnowledgeRuleCitations,
  getKnowledgeSources,
  getScoutingLogByDate,
  getSessionLogByDate,
  getStudentsByClass,
  getTrainingPlans,
} from "../../../db/seed";

type UseSessionDataParams = {
  classId: string;
  sessionDate: string;
  weekdayId: number;
  scoutingMode: "treino" | "jogo";
  compactTrainingPlans: (plans: TrainingPlan[]) => TrainingPlan[];
};

const pickClassPlanForSessionDate = (plans: ClassPlan[], sessionDateValue: string) => {
  if (!plans.length) return null;
  const targetTime = Date.parse(`${sessionDateValue}T00:00:00`);
  const sorted = [...plans].sort((a, b) => {
    const aTime = Date.parse(`${a.startDate}T00:00:00`);
    const bTime = Date.parse(`${b.startDate}T00:00:00`);
    return aTime - bTime;
  });
  const candidate = [...sorted]
    .reverse()
    .find((plan) => Date.parse(`${plan.startDate}T00:00:00`) <= targetTime);
  return candidate ?? sorted[0] ?? null;
};

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
  const [sessionLog, setSessionLog] = useState<SessionLog | null>(null);
  const [scoutingLog, setScoutingLog] = useState<ScoutingLog | null>(null);
  const [attendancePercent, setAttendancePercent] = useState<number | null>(null);
  const [currentClassPlan, setCurrentClassPlan] = useState<ClassPlan | null>(null);
  const [currentDailyLessonPlan, setCurrentDailyLessonPlan] =
    useState<DailyLessonPlan | null>(null);
  const [isResolvingCurrentClassPlan, setIsResolvingCurrentClassPlan] = useState(false);
  const [methodologyEvidence, setMethodologyEvidence] =
    useState<SessionMethodologyEvidence | null>(null);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    setIsLoadingSession(true);

    (async () => {
      try {
        const data = await getClassById(classId);
        if (alive) setCls(data);
        if (data) {
          const [classStudents, currentPlan, classTrainingPlans] = await Promise.all([
            getStudentsByClass(data.id),
            getLatestFinalPlanForSession(
              data.organizationId ?? null,
              data.id,
              sessionDate,
              weekdayId
            ),
            getTrainingPlans({
              organizationId: data.organizationId ?? null,
              classId: data.id,
              status: "final",
              orderBy: "createdat_desc",
              limit: 24,
            }),
          ]);
          if (alive) {
            setSessionStudents(classStudents);
            setSavedClassPlans(compactTrainingPlans(classTrainingPlans));
            setPlan(currentPlan);
          }
          if (!alive) return;
        } else if (alive) {
          setSavedClassPlans([]);
          setSessionStudents([]);
          setPlan(null);
        }

        if (classId) {
          const [log, scouting] = await Promise.all([
            getSessionLogByDate(classId, sessionDate),
            getScoutingLogByDate(classId, sessionDate, scoutingMode),
          ]);
          if (alive) {
            setSessionLog(log);
            setScoutingLog(scouting);
          }
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
        setCurrentClassPlan(pickClassPlanForSessionDate(plans, sessionDate));
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
    sessionLog,
    setSessionLog,
    scoutingLog,
    setScoutingLog,
    attendancePercent,
    currentClassPlan,
    currentDailyLessonPlan,
    isResolvingCurrentClassPlan,
    methodologyEvidence,
    reload,
  };
}
