jest.mock("../../../../db/observability-summaries", () => ({
  buildObservabilityRecommendationsFromRecords: jest.fn(() => []),
  buildObservabilityInsightsFromRecords: jest.fn(() => []),
  computeDriftFrequencyFromRecords: jest.fn(() => []),
  computeObservabilityTrendFromRecords: jest.fn(() => ({
    totalWeeks: 0,
    coherentWeeks: 0,
    coherencePassRate: 0,
    averageCoherenceScore: 0,
    unstableWeeks: 0,
    highSeverityWeeks: 0,
    attentionWeeks: 0,
    authorityViolationWeeks: 0,
  })),
  computeRecentUnstableWeeksFromRecords: jest.fn(() => []),
}));

import { buildRecommendationDecisionStates } from "../usePeriodizationDerivedState";

describe("buildRecommendationDecisionStates", () => {
  it("marks recommendations as pending when there is no decision for the active plan", () => {
    const result = buildRecommendationDecisionStates({
      recommendations: [
        {
          code: "restore_weekly_role_alignment",
          priority: "high",
          action: "review_current_week",
          title: "Restaurar alinhamento entre semana e sessao",
          message: "Uma ou mais sessoes estao escapando do papel semanal.",
          rationale: "A autoridade semanal foi quebrada em multiplas semanas.",
          sourceSignals: ["authority_break_recurrence"],
        },
      ],
      recommendationDecisions: [],
      activePlanId: "plan-1",
    });

    expect(result).toEqual([
      {
        recommendation: expect.objectContaining({ code: "restore_weekly_role_alignment" }),
        decisionStatus: "pending",
        decision: null,
      },
    ]);
  });

  it("uses the latest decision recorded for the active plan", () => {
    const result = buildRecommendationDecisionStates({
      recommendations: [
        {
          code: "restore_weekly_role_alignment",
          priority: "high",
          action: "review_current_week",
          title: "Restaurar alinhamento entre semana e sessao",
          message: "Uma ou mais sessoes estao escapando do papel semanal.",
          rationale: "A autoridade semanal foi quebrada em multiplas semanas.",
          sourceSignals: ["authority_break_recurrence"],
        },
      ],
      recommendationDecisions: [
        {
          id: "decision-1",
          classId: "class-1",
          cycleId: "cycle-1",
          planId: "plan-1",
          weekNumber: 3,
          recommendationCode: "restore_weekly_role_alignment",
          status: "accepted",
          priority: "high",
          title: "Restaurar alinhamento entre semana e sessao",
          message: "Uma ou mais sessoes estao escapando do papel semanal.",
          rationale: "A autoridade semanal foi quebrada em multiplas semanas.",
          sourceSignals: ["authority_break_recurrence"],
          reasonType: "accepted_without_note",
          reasonNote: null,
          createdAt: "2026-05-01T10:00:00.000Z",
          updatedAt: "2026-05-01T10:00:00.000Z",
        },
        {
          id: "decision-2",
          classId: "class-1",
          cycleId: "cycle-1",
          planId: "plan-2",
          weekNumber: 4,
          recommendationCode: "restore_weekly_role_alignment",
          status: "rejected",
          priority: "high",
          title: "Restaurar alinhamento entre semana e sessao",
          message: "Uma ou mais sessoes estao escapando do papel semanal.",
          rationale: "A autoridade semanal foi quebrada em multiplas semanas.",
          sourceSignals: ["authority_break_recurrence"],
          reasonType: "not_relevant",
          reasonNote: null,
          createdAt: "2026-05-02T10:00:00.000Z",
          updatedAt: "2026-05-02T10:00:00.000Z",
        },
      ],
      activePlanId: "plan-1",
    });

    expect(result[0]?.decisionStatus).toBe("accepted");
    expect(result[0]?.decision?.planId).toBe("plan-1");
  });
});
