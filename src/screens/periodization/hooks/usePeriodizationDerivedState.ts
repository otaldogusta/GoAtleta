import { useMemo } from "react";
import type {
    DerivedObservabilityRecommendationState,
    ObservabilityRecommendation,
    ObservabilityRecommendationDecision,
    RankedObservabilityRecommendation,
    RecommendationAxisAlignmentSummary,
    RecommendationAxisPersistenceSummary,
    RecommendationAxisTransitionSummary,
    RecommendationEvidence,
    RecommendationFamilyAggregate,
    RecommendationProblemAxisSummary,
    RecommendationProblemFamilySummary,
    RecommendationProblemFamilyTimelineItem,
    RecommendationQADigest,
    RecommendationWindowComparisonSummary,
    WeeklyOperationalStrategySnapshot,
} from "../../../core/models";
import type {
    DriftFrequencyByClassItem,
    ObservabilityInsight,
    ObservabilityTrendByClass,
    PlanObservabilityRecord,
    UnstableObservabilityWeek,
} from "../../../db/observability-summaries";
import {
    buildObservabilityInsightsFromRecords,
    buildObservabilityRecommendationsFromRecords,
    buildRankedRecommendations,
    buildRecommendationAxisAlignmentSummary,
    buildRecommendationAxisPersistenceSummary,
    buildRecommendationAxisTransitionSummary,
    buildRecommendationEvidenceFromRecords,
    buildRecommendationFamilyAggregates,
    buildRecommendationProblemAxisSummary,
    buildRecommendationProblemFamilySummary,
    buildRecommendationProblemFamilyTimeline,
    buildRecommendationQADigest,
    buildRecommendationWindowComparisonSummary,
    computeDriftFrequencyFromRecords,
    computeObservabilityTrendFromRecords,
    computeRecentUnstableWeeksFromRecords,
} from "../../../db/observability-summaries";
import {
    formatWeeklyOperationalIntentForTeacher,
    type WeeklyOperationalTeacherIntent,
} from "../application/format-weekly-operational-intent-for-teacher";

type UsePeriodizationDerivedStateParams = {
  planObservabilityHistory: PlanObservabilityRecord[];
  recommendationDecisions: ObservabilityRecommendationDecision[];
  activePlanId?: string | null;
  weeklyOperationalSnapshot: WeeklyOperationalStrategySnapshot | null;
  unstableWeeksLimit?: number;
};

type UsePeriodizationDerivedStateResult = {
  weeklyTeacherIntent: WeeklyOperationalTeacherIntent | null;
  classObservabilityTrend: ObservabilityTrendByClass;
  classObservabilityDriftFrequency: DriftFrequencyByClassItem[];
  classRecentUnstableWeeks: UnstableObservabilityWeek[];
  classObservabilityInsights: ObservabilityInsight[];
  classObservabilityRecommendations: ObservabilityRecommendation[];
  classRankedRecommendations: RankedObservabilityRecommendation[];
  classObservabilityRecommendationStates: DerivedObservabilityRecommendationState[];
  classRecommendationEvidence: RecommendationEvidence[];
  classRecommendationAggregates: RecommendationFamilyAggregate[];
  classRecommendationProblemFamilySummary: RecommendationProblemFamilySummary;
  classRecommendationProblemAxisSummary: RecommendationProblemAxisSummary | null;
  classRecommendationProblemFamilyTimeline: RecommendationProblemFamilyTimelineItem[];
  classRecommendationAxisTransitionSummary: RecommendationAxisTransitionSummary | null;
  classRecommendationAxisPersistenceSummary: RecommendationAxisPersistenceSummary | null;
  classRecommendationQADigest: RecommendationQADigest | null;
  classRecommendationWindowComparison: RecommendationWindowComparisonSummary | null;
  classRecommendationAxisAlignment: RecommendationAxisAlignmentSummary | null;
};

export function buildRecommendationDecisionStates(params: {
  recommendations: ObservabilityRecommendation[];
  recommendationDecisions: ObservabilityRecommendationDecision[];
  activePlanId?: string | null;
}): DerivedObservabilityRecommendationState[] {
  const { recommendations, recommendationDecisions, activePlanId } = params;
  const currentPlanId = activePlanId ?? null;
  const decisionByCode = new Map<string, ObservabilityRecommendationDecision>();

  if (currentPlanId) {
    recommendationDecisions
      .filter((decision) => decision.planId === currentPlanId)
      .forEach((decision) => {
        if (!decisionByCode.has(decision.recommendationCode)) {
          decisionByCode.set(decision.recommendationCode, decision);
        }
      });
  }

  return recommendations.map((recommendation) => {
    const decision = decisionByCode.get(recommendation.code) ?? null;
    return {
      recommendation,
      decisionStatus: decision?.status === "accepted" ? "accepted" : decision?.status === "rejected" ? "rejected" : "pending",
      decision,
    };
  });
}

export function usePeriodizationDerivedState({
  planObservabilityHistory,
  recommendationDecisions,
  activePlanId,
  weeklyOperationalSnapshot,
  unstableWeeksLimit = 5,
}: UsePeriodizationDerivedStateParams): UsePeriodizationDerivedStateResult {
  const weeklyTeacherIntent = useMemo(() => {
    return formatWeeklyOperationalIntentForTeacher(weeklyOperationalSnapshot);
  }, [weeklyOperationalSnapshot]);

  const classObservabilityTrend = useMemo<ObservabilityTrendByClass>(
    () => computeObservabilityTrendFromRecords(planObservabilityHistory),
    [planObservabilityHistory]
  );

  const classObservabilityDriftFrequency = useMemo<DriftFrequencyByClassItem[]>(
    () => computeDriftFrequencyFromRecords(planObservabilityHistory),
    [planObservabilityHistory]
  );

  const classRecentUnstableWeeks = useMemo<UnstableObservabilityWeek[]>(
    () => computeRecentUnstableWeeksFromRecords(planObservabilityHistory, unstableWeeksLimit),
    [planObservabilityHistory, unstableWeeksLimit]
  );

  const classObservabilityInsights = useMemo<ObservabilityInsight[]>(
    () => buildObservabilityInsightsFromRecords(planObservabilityHistory),
    [planObservabilityHistory]
  );

  const classObservabilityRecommendations = useMemo<ObservabilityRecommendation[]>(
    () => buildObservabilityRecommendationsFromRecords(planObservabilityHistory),
    [planObservabilityHistory]
  );

  const classRecommendationEvidence = useMemo<RecommendationEvidence[]>(
    () =>
      buildRecommendationEvidenceFromRecords({
        decisions: recommendationDecisions,
        records: planObservabilityHistory,
        lookaheadWeeks: 2,
      }),
    [planObservabilityHistory, recommendationDecisions]
  );

  const classRecommendationAggregates = useMemo<RecommendationFamilyAggregate[]>(
    () =>
      buildRecommendationFamilyAggregates({
        decisions: recommendationDecisions,
        evidence: classRecommendationEvidence,
      }),
    [classRecommendationEvidence, recommendationDecisions]
  );

  const classRankedRecommendations = useMemo<RankedObservabilityRecommendation[]>(
    () =>
      buildRankedRecommendations({
        recommendations: classObservabilityRecommendations,
        aggregates: classRecommendationAggregates,
      }),
    [classObservabilityRecommendations, classRecommendationAggregates]
  );

  const classObservabilityRecommendationStates = useMemo<DerivedObservabilityRecommendationState[]>(
    () =>
      buildRecommendationDecisionStates({
        recommendations: classRankedRecommendations.map((item) => item.recommendation),
        recommendationDecisions,
        activePlanId,
      }),
    [activePlanId, classRankedRecommendations, recommendationDecisions]
  );

  const classRecommendationProblemFamilySummary = useMemo<RecommendationProblemFamilySummary>(
    () =>
      buildRecommendationProblemFamilySummary({
        rankedRecommendations: classRankedRecommendations,
      }),
    [classRankedRecommendations]
  );

  const classRecommendationProblemAxisSummary = useMemo<RecommendationProblemAxisSummary | null>(
    () =>
      buildRecommendationProblemAxisSummary({
        familySummary: classRecommendationProblemFamilySummary,
      }),
    [classRecommendationProblemFamilySummary]
  );

  const classRecommendationProblemFamilyTimeline = useMemo<RecommendationProblemFamilyTimelineItem[]>(
    () =>
      buildRecommendationProblemFamilyTimeline({
        records: planObservabilityHistory,
      }),
    [planObservabilityHistory]
  );

  const classRecommendationAxisTransitionSummary = useMemo<RecommendationAxisTransitionSummary | null>(
    () =>
      buildRecommendationAxisTransitionSummary({
        timeline: classRecommendationProblemFamilyTimeline,
      }),
    [classRecommendationProblemFamilyTimeline]
  );

  const classRecommendationAxisPersistenceSummary = useMemo<RecommendationAxisPersistenceSummary | null>(
    () =>
      buildRecommendationAxisPersistenceSummary({
        timeline: classRecommendationProblemFamilyTimeline,
      }),
    [classRecommendationProblemFamilyTimeline]
  );

  const classRecommendationQADigest = useMemo<RecommendationQADigest | null>(() => {
    if (!classRecommendationProblemAxisSummary && !classRecommendationAxisPersistenceSummary) return null;
    return buildRecommendationQADigest({
      axisSummary: classRecommendationProblemAxisSummary,
      persistenceSummary: classRecommendationAxisPersistenceSummary,
      rankedRecommendations: classRankedRecommendations,
    });
  }, [classRecommendationProblemAxisSummary, classRecommendationAxisPersistenceSummary, classRankedRecommendations]);

  const classRecommendationWindowComparison = useMemo<RecommendationWindowComparisonSummary | null>(
    () =>
      buildRecommendationWindowComparisonSummary({
        timeline: classRecommendationProblemFamilyTimeline,
      }),
    [classRecommendationProblemFamilyTimeline]
  );

  const classRecommendationAxisAlignment = useMemo<RecommendationAxisAlignmentSummary | null>(
    () =>
      buildRecommendationAxisAlignmentSummary({
        axisSummary: classRecommendationProblemAxisSummary,
        rankedRecommendations: classRankedRecommendations,
      }),
    [classRecommendationProblemAxisSummary, classRankedRecommendations]
  );

  return {
    weeklyTeacherIntent,
    classObservabilityTrend,
    classObservabilityDriftFrequency,
    classRecentUnstableWeeks,
    classObservabilityInsights,
    classObservabilityRecommendations,
    classRankedRecommendations,
    classObservabilityRecommendationStates,
    classRecommendationEvidence,
    classRecommendationAggregates,
    classRecommendationProblemFamilySummary,
    classRecommendationProblemAxisSummary,
    classRecommendationProblemFamilyTimeline,
    classRecommendationAxisTransitionSummary,
    classRecommendationAxisPersistenceSummary,
    classRecommendationQADigest,
    classRecommendationWindowComparison,
    classRecommendationAxisAlignment,
  };
}
