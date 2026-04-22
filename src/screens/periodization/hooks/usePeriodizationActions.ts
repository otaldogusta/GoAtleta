import type { MutableRefObject } from "react";
import { useCallback, useEffect, useState } from "react";
import type {
    ObservabilityRecommendation,
    ObservabilityRecommendationDecision,
    ObservabilityRecommendationDecisionReasonType,
} from "../../../core/models";
import { usePersistedState } from "../../../ui/use-persisted-state";

type UsePeriodizationActionsParams = {
  hasWeekPlans: boolean;
  currentWeek: number;
  totalWeeks: number;
  weekSwitchDirectionRef: MutableRefObject<-1 | 0 | 1>;
  persistRecommendationDecision?: (
    decision: ObservabilityRecommendationDecision
  ) => Promise<void>;
};

export function usePeriodizationActions({
  hasWeekPlans,
  currentWeek,
  totalWeeks,
  weekSwitchDirectionRef,
  persistRecommendationDecision,
}: UsePeriodizationActionsParams) {
  const [agendaWeekNumber, setAgendaWeekNumber] = useState<number | null>(null);
  const [qaModeEnabled, setQaModeEnabled] = usePersistedState<boolean>(
    __DEV__ ? "periodization.qa.mode" : null,
    false
  );
  const [showQaDebugPanel, setShowQaDebugPanel] = useState(false);

  useEffect(() => {
    if (!qaModeEnabled && showQaDebugPanel) {
      setShowQaDebugPanel(false);
    }
  }, [qaModeEnabled, showQaDebugPanel]);

  const goToPreviousAgendaWeek = useCallback(() => {
    weekSwitchDirectionRef.current = -1;
    setAgendaWeekNumber((prev) => {
      if (!hasWeekPlans) return prev;
      const current = prev ?? currentWeek;
      return Math.max(1, current - 1);
    });
  }, [currentWeek, hasWeekPlans, weekSwitchDirectionRef]);

  const goToNextAgendaWeek = useCallback(() => {
    weekSwitchDirectionRef.current = 1;
    setAgendaWeekNumber((prev) => {
      if (!hasWeekPlans) return prev;
      const current = prev ?? currentWeek;
      return Math.min(totalWeeks, current + 1);
    });
  }, [currentWeek, hasWeekPlans, totalWeeks, weekSwitchDirectionRef]);

  const goToWeek = useCallback(
    (weekNumber: number) => {
      weekSwitchDirectionRef.current = 0;
      if (totalWeeks <= 0) return;
      setAgendaWeekNumber(Math.max(1, Math.min(totalWeeks, weekNumber)));
    },
    [totalWeeks, weekSwitchDirectionRef]
  );

  const toggleQaMode = useCallback(() => {
    setQaModeEnabled((current) => !current);
  }, [setQaModeEnabled]);

  const toggleQaDebugPanel = useCallback(() => {
    setShowQaDebugPanel((current) => !current);
  }, []);

  const acceptRecommendation = useCallback(
    async (params: {
      recommendation: ObservabilityRecommendation;
      classId: string;
      cycleId: string;
      planId: string;
      weekNumber: number;
      reasonNote?: string;
    }) => {
      if (!persistRecommendationDecision) return;
      const nowIso = new Date().toISOString();
      await persistRecommendationDecision({
        id: `${params.planId}:${params.recommendation.code}`,
        classId: params.classId,
        cycleId: params.cycleId,
        planId: params.planId,
        weekNumber: params.weekNumber,
        recommendationCode: params.recommendation.code,
        status: "accepted",
        priority: params.recommendation.priority,
        title: params.recommendation.title,
        message: params.recommendation.message,
        rationale: params.recommendation.rationale,
        sourceSignals: params.recommendation.sourceSignals,
        reasonType: params.reasonNote ? "teacher_judgment" : "accepted_without_note",
        reasonNote: params.reasonNote ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    },
    [persistRecommendationDecision]
  );

  const rejectRecommendation = useCallback(
    async (params: {
      recommendation: ObservabilityRecommendation;
      classId: string;
      cycleId: string;
      planId: string;
      weekNumber: number;
      reasonType?: ObservabilityRecommendationDecisionReasonType;
      reasonNote?: string;
    }) => {
      if (!persistRecommendationDecision) return;
      const nowIso = new Date().toISOString();
      await persistRecommendationDecision({
        id: `${params.planId}:${params.recommendation.code}`,
        classId: params.classId,
        cycleId: params.cycleId,
        planId: params.planId,
        weekNumber: params.weekNumber,
        recommendationCode: params.recommendation.code,
        status: "rejected",
        priority: params.recommendation.priority,
        title: params.recommendation.title,
        message: params.recommendation.message,
        rationale: params.recommendation.rationale,
        sourceSignals: params.recommendation.sourceSignals,
        reasonType: params.reasonType ?? "not_relevant",
        reasonNote: params.reasonNote ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    },
    [persistRecommendationDecision]
  );

  return {
    agendaWeekNumber,
    setAgendaWeekNumber,
    goToPreviousAgendaWeek,
    goToNextAgendaWeek,
    goToWeek,
    qaModeEnabled,
    showQaDebugPanel,
    toggleQaMode,
    toggleQaDebugPanel,
    acceptRecommendation,
    rejectRecommendation,
  };
}
