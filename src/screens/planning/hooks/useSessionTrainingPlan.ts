import { useCallback, useState } from "react";

import type {
  AttendanceRecord,
  ClassCalendarException,
  ClassGroup,
  SessionLog,
  Student,
  TrainingPlan,
} from "../../../core/models";
import type { StudentPlanningContextInput } from "../application/build-unified-planning-context";
import { buildUnifiedPlanningContext } from "../application/build-unified-planning-context";
import { createTrainingPlanVersion } from "../../../core/training-plan-factory";
import {
  deleteTrainingPlan,
  deleteTrainingPlansByClassAndDate,
  getLatestTrainingPlanByClass,
  getTrainingPlans,
  saveTrainingPlan,
} from "../../../db/training";
import { buildAutoPlanForCycleDay } from "../../session/application/build-auto-plan-for-cycle-day";
import { convertPedagogicalPackageToTrainingPlan } from "../../session/application/convert-pedagogical-package-to-training-plan";
import { retrieveDocumentSupportForPlan } from "../../session/application/retrieve-document-support-for-plan";
import type { ProfessorAgendaEvent } from "../application/professor-agenda-events";

type UseSessionTrainingPlanParams = {
  classGroup: ClassGroup | null;
  students?: Student[];
  calendarExceptions?: ClassCalendarException[];
  recentAttendance?: AttendanceRecord[];
  recentSessionLogs?: SessionLog[];
  studentContexts?: StudentPlanningContextInput[];
};

export function useSessionTrainingPlan({
  classGroup,
  students = [],
  calendarExceptions = [],
  recentAttendance = [],
  recentSessionLogs = [],
  studentContexts = [],
}: UseSessionTrainingPlanParams) {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [lessonDate, setLessonDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadOrGenerate = useCallback(
    async (event: ProfessorAgendaEvent) => {
      if (!classGroup) throw new Error("Turma indisponível para abrir o plano.");
      setIsLoading(true);
      try {
        const existingPlans = await getTrainingPlans({
          organizationId: classGroup.organizationId,
          classId: classGroup.id,
          applyDate: event.date,
          orderBy: "version_desc",
          limit: 1,
        });
        const existingPlan = existingPlans[0] ?? null;
        if (existingPlan) {
          setPlan(existingPlan);
          setLessonDate(event.date);
          return existingPlan;
        }

        const recentPlans = await getTrainingPlans({
          organizationId: classGroup.organizationId,
          classId: classGroup.id,
          status: "final",
          orderBy: "createdat_desc",
          limit: 12,
        });
        const documentSupport = await retrieveDocumentSupportForPlan({
          classGroup,
          sessionDate: event.date,
          classPlan: event.plan,
          dailyLessonPlan: event.dailyPlan,
        }).catch(() => undefined);
        const unifiedContext = buildUnifiedPlanningContext({
          classGroup,
          referenceDate: event.date,
          recentAttendance,
          recentSessionLogs,
          studentContexts,
        });
        const generated = buildAutoPlanForCycleDay({
          classGroup,
          classPlan: event.plan,
          dailyLessonPlan: event.dailyPlan,
          students,
          sessionDate: event.date,
          sessionIndexInWeek: event.sessionIndex,
          recentPlans,
          documentSupport,
          calendarExceptions,
          attendance: unifiedContext.attendance,
          sessionLogs: unifiedContext.sessionLogs,
          dimensionGuidelines: unifiedContext.dimensionGuidelines,
        });
        const latestVersion = recentPlans.reduce(
          (maximum, item) => Math.max(maximum, item.version ?? 0),
          0,
        );
        const generatedPlan = {
          ...convertPedagogicalPackageToTrainingPlan({
            pkg: generated.package,
            classId: classGroup.id,
            sessionDate: event.date,
            existingPlan: null,
            version: latestVersion + 1,
          }),
          applyDays: [],
          status: "generated" as const,
          origin: "auto" as const,
          finalizedAt: undefined,
        };
        await saveTrainingPlan(generatedPlan, {
          organizationId: classGroup.organizationId,
        });
        setPlan(generatedPlan);
        setLessonDate(event.date);
        return generatedPlan;
      } finally {
        setIsLoading(false);
      }
    },
    [
      calendarExceptions,
      classGroup,
      recentAttendance,
      recentSessionLogs,
      studentContexts,
      students,
    ],
  );

  const savePlan = useCallback(
    async (draft: TrainingPlan) => {
      if (!classGroup || !lessonDate) {
        throw new Error("Turma ou data da aula indisponível.");
      }
      const latestPlan = await getLatestTrainingPlanByClass(classGroup.id, {
        organizationId: classGroup.organizationId,
      });
      const nowIso = new Date().toISOString();
      const nextPlan = createTrainingPlanVersion({
        classId: classGroup.id,
        version: Math.max(draft.version ?? 0, latestPlan?.version ?? 0) + 1,
        origin: draft.origin === "auto" ? "edited_auto" : "manual",
        draft: {
          title: draft.title,
          tags: draft.tags,
          warmup: draft.warmup,
          main: draft.main,
          cooldown: draft.cooldown,
          warmupTime: draft.warmupTime,
          mainTime: draft.mainTime,
          cooldownTime: draft.cooldownTime,
        },
        applyDays: [],
        applyDate: lessonDate,
        inputHash: draft.inputHash,
        nowIso,
        idPrefix: "plan_edit",
        status: "final",
        generatedAt: draft.generatedAt,
        finalizedAt: nowIso,
        parentPlanId: draft.parentPlanId ?? draft.id,
        previousVersionId: draft.id,
        pedagogy: draft.pedagogy,
      });
      await saveTrainingPlan(nextPlan, {
        organizationId: classGroup.organizationId,
      });
      setPlan(nextPlan);
      return nextPlan;
    },
    [classGroup, lessonDate],
  );

  const removePlan = useCallback(async () => {
    if (!classGroup || !plan || !lessonDate) return;
    if (plan.applyDate) {
      await deleteTrainingPlansByClassAndDate(classGroup.id, lessonDate, {
        organizationId: classGroup.organizationId,
      });
    } else {
      await deleteTrainingPlan(plan.id, {
        organizationId: classGroup.organizationId,
      });
    }
    setPlan(null);
  }, [classGroup, lessonDate, plan]);

  const clear = useCallback(() => {
    setPlan(null);
    setLessonDate("");
  }, []);

  return {
    plan,
    lessonDate,
    isLoading,
    loadOrGenerate,
    savePlan,
    removePlan,
    clear,
  };
}
