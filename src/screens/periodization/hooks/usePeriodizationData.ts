import { useCallback, useEffect, useState } from "react";
import type {
    ClassPlan,
    ObservabilityRecommendationDecision,
    WeeklyObservabilitySummary,
} from "../../../core/models";
import type { PlanObservabilityRecord } from "../../../db/observability-summaries";
import {
    listPlanObservabilitySummariesByClass,
    upsertPlanObservabilitySummary,
} from "../../../db/observability-summaries";
import {
    listRecommendationDecisionsByClass,
    upsertRecommendationDecision,
} from "../../../db/recommendation-decisions";

type UsePeriodizationDataParams = {
  selectedClassId?: string;
  activeClassPlan: ClassPlan | null;
  weeklyObservabilitySummary: WeeklyObservabilitySummary | null;
};

export function usePeriodizationData({
  selectedClassId,
  activeClassPlan,
  weeklyObservabilitySummary,
}: UsePeriodizationDataParams) {
  const [planObservabilityHistory, setPlanObservabilityHistory] = useState<PlanObservabilityRecord[]>([]);
  const [recommendationDecisions, setRecommendationDecisions] = useState<
    ObservabilityRecommendationDecision[]
  >([]);

  const reloadPlanObservabilityHistory = useCallback(async () => {
    if (!selectedClassId) {
      setPlanObservabilityHistory([]);
      return;
    }

    try {
      const records = await listPlanObservabilitySummariesByClass(selectedClassId);
      setPlanObservabilityHistory(records);
    } catch {
      setPlanObservabilityHistory([]);
    }
  }, [selectedClassId]);

  const reloadRecommendationDecisions = useCallback(async () => {
    if (!selectedClassId) {
      setRecommendationDecisions([]);
      return;
    }

    try {
      const records = await listRecommendationDecisionsByClass(selectedClassId);
      setRecommendationDecisions(records);
    } catch {
      setRecommendationDecisions([]);
    }
  }, [selectedClassId]);

  const persistRecommendationDecision = useCallback(
    async (decision: ObservabilityRecommendationDecision) => {
      await upsertRecommendationDecision(decision);
      await reloadRecommendationDecisions();
    },
    [reloadRecommendationDecisions]
  );

  useEffect(() => {
    void reloadPlanObservabilityHistory();
  }, [reloadPlanObservabilityHistory]);

  useEffect(() => {
    void reloadRecommendationDecisions();
  }, [reloadRecommendationDecisions]);

  useEffect(() => {
    if (!activeClassPlan || !weeklyObservabilitySummary) return;

    void upsertPlanObservabilitySummary({
      planId: activeClassPlan.id,
      classId: activeClassPlan.classId,
      cycleId: activeClassPlan.cycleId ?? "",
      weekNumber: activeClassPlan.weekNumber,
      summary: weeklyObservabilitySummary,
    })
      .then(() => reloadPlanObservabilityHistory())
      .catch(() => {});
  }, [
    activeClassPlan?.id,
    activeClassPlan?.classId,
    activeClassPlan?.cycleId,
    activeClassPlan?.weekNumber,
    reloadPlanObservabilityHistory,
    weeklyObservabilitySummary,
  ]);

  return {
    planObservabilityHistory,
    recommendationDecisions,
    reloadPlanObservabilityHistory,
    reloadRecommendationDecisions,
    persistRecommendationDecision,
  };
}
