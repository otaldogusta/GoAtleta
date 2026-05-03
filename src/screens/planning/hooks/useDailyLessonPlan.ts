import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ClassGroup,
  ClassPlan,
  DailyLessonPlan,
  LessonBlock,
  SessionEnvironment,
  SessionPrimaryComponent,
} from "../../../core/models";
import {
    getDailyLessonPlanByWeekAndDate,
    listRecentDailyLessonPlansByClass,
    upsertDailyLessonPlan,
} from "../../../db/seed";
import type { WeekSessionPreview } from "../../periodization/application/build-week-session-preview";
import { deriveLegacyDailySections, serializeLessonBlocks } from "../application/daily-lesson-blocks";
import {
    buildAutoDailyLessonPlan,
    regenerateDailyLessonPlanFromWeek,
} from "../application/regenerate-daily-lesson-plan";

type UseDailyLessonPlanOptions = {
  className?: string;
  ageBand?: string;
  durationMinutes?: number;
  cycleStartDate?: string;
  cycleEndDate?: string;
  classGroup?: ClassGroup | null;
};

const resolveSessionPrimaryComponent = (
  environment: SessionEnvironment,
): SessionPrimaryComponent => {
  if (environment === "academia") return "resistido";
  if (environment === "mista") return "misto_transferencia";
  if (environment === "preventiva") return "preventivo";
  return "tecnico_tatico";
};

export function useDailyLessonPlan(
  weeklyPlan: ClassPlan | null,
  session: WeekSessionPreview | null,
  options?: UseDailyLessonPlanOptions
) {
  const [plan, setPlan] = useState<DailyLessonPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!weeklyPlan || !session) {
      setPlan(null);
      return;
    }

    setIsLoading(true);
    try {
      const recentPlans = await listRecentDailyLessonPlansByClass(weeklyPlan.classId, 12);
      const existing = await getDailyLessonPlanByWeekAndDate(weeklyPlan.id, session.date);

      if (!existing) {
        setPlan(
          buildAutoDailyLessonPlan(weeklyPlan, session, new Date().toISOString(), null, {
            className: options?.className,
            ageBand: options?.ageBand,
            durationMinutes: options?.durationMinutes,
            cycleStartDate: options?.cycleStartDate,
            cycleEndDate: options?.cycleEndDate,
            classGroup: options?.classGroup,
            recentPlans,
          })
        );
        return;
      }

      const isOutdated =
        existing.syncStatus === "out_of_sync" ||
        (existing.derivedFromWeeklyVersion ?? 0) < (weeklyPlan.generationVersion ?? 1);

      if (isOutdated) {
        const regenerated = regenerateDailyLessonPlanFromWeek({
          existing,
          weeklyPlan,
          session,
          context: {
            className: options?.className,
            ageBand: options?.ageBand,
            durationMinutes: options?.durationMinutes,
            cycleStartDate: options?.cycleStartDate,
            cycleEndDate: options?.cycleEndDate,
            classGroup: options?.classGroup,
            recentPlans,
          },
        });
        await upsertDailyLessonPlan(regenerated);
        setPlan(regenerated);
        return;
      }

      setPlan(existing);
    } finally {
      setIsLoading(false);
    }
  }, [
    options?.ageBand,
    options?.className,
    options?.classGroup,
    options?.cycleEndDate,
    options?.cycleStartDate,
    options?.durationMinutes,
    session,
    weeklyPlan,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (payload: {
      title: string;
      blocks: LessonBlock[];
      observations: string;
      sessionEnvironment: SessionEnvironment;
    }) => {
      if (!weeklyPlan || !session) return null;

      const nowIso = new Date().toISOString();
      const recentPlans = await listRecentDailyLessonPlansByClass(weeklyPlan.classId, 12);
      const base =
        plan ??
        buildAutoDailyLessonPlan(weeklyPlan, session, nowIso, null, {
          className: options?.className,
          ageBand: options?.ageBand,
          durationMinutes: options?.durationMinutes,
          cycleStartDate: options?.cycleStartDate,
          cycleEndDate: options?.cycleEndDate,
          classGroup: options?.classGroup,
          recentPlans,
        });

      const legacySections = deriveLegacyDailySections(payload.blocks);
      const manualMask = {
        title: payload.title.trim() !== (base.title ?? "").trim(),
        warmup: legacySections.warmup.trim() !== (base.warmup ?? "").trim(),
        mainPart: legacySections.mainPart.trim() !== (base.mainPart ?? "").trim(),
        cooldown: legacySections.cooldown.trim() !== (base.cooldown ?? "").trim(),
        observations: payload.observations.trim() !== (base.observations ?? "").trim(),
        sessionEnvironment:
          payload.sessionEnvironment !== (base.sessionEnvironment ?? "quadra"),
      };
      const manualOverrideFields = (Object.keys(manualMask) as (keyof typeof manualMask)[]).filter(
        (key) => manualMask[key]
      );
      const hasManualOverrides = manualOverrideFields.length > 0;

      const next: DailyLessonPlan = {
        ...base,
        title: payload.title,
        blocksJson: serializeLessonBlocks(payload.blocks),
        warmup: legacySections.warmup,
        mainPart: legacySections.mainPart,
        cooldown: legacySections.cooldown,
        observations: payload.observations,
        sessionEnvironment: payload.sessionEnvironment,
        sessionPrimaryComponent: resolveSessionPrimaryComponent(payload.sessionEnvironment),
        sessionComponents:
          payload.sessionEnvironment === "quadra" ? [] : base.sessionComponents,
        syncStatus: hasManualOverrides ? "overridden" : "in_sync",
        manualOverridesJson: JSON.stringify(manualMask),
        manualOverrideMaskJson: JSON.stringify(manualOverrideFields),
        lastManualEditedAt: hasManualOverrides ? nowIso : base.lastManualEditedAt,
        updatedAt: nowIso,
      };

      await upsertDailyLessonPlan(next);
      setPlan(next);
      return next;
    },
    [
      options?.ageBand,
      options?.className,
      options?.classGroup,
      options?.cycleEndDate,
      options?.cycleStartDate,
      options?.durationMinutes,
      plan,
      session,
      weeklyPlan,
    ]
  );

  const regenerate = useCallback(async () => {
    if (!weeklyPlan || !session) return null;

    const recentPlans = await listRecentDailyLessonPlansByClass(weeklyPlan.classId, 12);
    const regenerated = regenerateDailyLessonPlanFromWeek({
      existing: plan,
      weeklyPlan,
      session,
      context: {
        className: options?.className,
        ageBand: options?.ageBand,
        durationMinutes: options?.durationMinutes,
        cycleStartDate: options?.cycleStartDate,
        cycleEndDate: options?.cycleEndDate,
        classGroup: options?.classGroup,
        recentPlans,
      },
    });

    await upsertDailyLessonPlan(regenerated);
    setPlan(regenerated);
    return regenerated;
  }, [
    options?.ageBand,
    options?.className,
    options?.classGroup,
    options?.cycleEndDate,
    options?.cycleStartDate,
    options?.durationMinutes,
    plan,
    session,
    weeklyPlan,
  ]);

  return useMemo(
    () => ({
      plan,
      isLoading,
      reload: load,
      save,
      regenerate,
    }),
    [isLoading, load, plan, regenerate, save]
  );
}
