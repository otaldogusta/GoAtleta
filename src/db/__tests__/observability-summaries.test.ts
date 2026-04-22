import type {
    ObservabilityRecommendationDecision,
    WeeklyObservabilitySeverity,
    WeeklyObservabilitySummary,
    WeeklyStabilityStatus,
} from "../../core/models";

jest.mock("../sqlite", () => ({
  db: {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
  },
}));

import {
    buildConfidenceInformedRecommendations,
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
    type PlanObservabilityRecord,
} from "../observability-summaries";

const buildSummary = (params: {
  stabilityStatus: WeeklyStabilityStatus;
  stabilitySeverity: WeeklyObservabilitySeverity;
  authorityHasViolations: boolean;
  authorityViolations?: WeeklyObservabilitySummary["authority"]["checks"][number]["violations"];
  coherenceOk?: boolean;
  quarter?: WeeklyObservabilitySummary["quarter"];
  closingType?: WeeklyObservabilitySummary["closingType"];
  driftCode?: WeeklyObservabilitySummary["driftSignals"][number]["code"];
}): WeeklyObservabilitySummary => ({
  quarterFocus: "Consolidacao",
  quarter: params.quarter ?? "Q3",
  closingType: params.closingType ?? "aplicacao",
  weekRulesApplied: ["weekly_role_template"],
  driftRisks: [],
  sessionRoleSummary: "S1 introducao",
  sessionSummaries: [{ sessionIndexInWeek: 1, sessionRole: "introducao_exploracao" }],
  coherence: [
    {
      sessionIndexInWeek: 1,
      sessionRole: "introducao_exploracao",
      envelopeRespected: params.coherenceOk ?? true,
    },
  ],
  authority: {
    checks: [
      {
        sessionIndexInWeek: 1,
        sessionRole: "introducao_exploracao",
        isWithinEnvelope: !params.authorityHasViolations,
        violations: params.authorityHasViolations
          ? params.authorityViolations ?? ["progression_outside_weekly_role"]
          : [],
      },
    ],
    passRate: params.authorityHasViolations ? 0 : 1,
    hasViolations: params.authorityHasViolations,
    totalChecks: 1,
    totalViolations: params.authorityHasViolations ? 1 : 0,
  },
  stability: {
    severity: params.stabilitySeverity,
    status: params.stabilityStatus,
    reasons: params.authorityHasViolations
      ? ["weekly_authority_violation"]
      : params.driftCode
        ? [params.driftCode]
        : [],
  },
  driftSignals: params.driftCode
    ? [
        {
          detected: true,
          severity: params.stabilitySeverity,
          reason: "signal",
          code: params.driftCode,
        },
      ]
    : [],
  sessionDebug: [
    {
      sessionIndex: 1,
      sessionRole: "introducao_exploracao",
      finalStrategy: null,
      rulesApplied: ["weekly_role_template"],
      envelopeRespected: true,
    },
  ],
});

const buildRecord = (params: {
  weekNumber: number;
  stabilityStatus: WeeklyStabilityStatus;
  stabilitySeverity: WeeklyObservabilitySeverity;
  authorityHasViolations: boolean;
  authorityViolations?: WeeklyObservabilitySummary["authority"]["checks"][number]["violations"];
  coherenceOk?: boolean;
  quarter?: WeeklyObservabilitySummary["quarter"];
  closingType?: WeeklyObservabilitySummary["closingType"];
  driftCode?: WeeklyObservabilitySummary["driftSignals"][number]["code"];
}): PlanObservabilityRecord => ({
  planId: `plan-${params.weekNumber}`,
  classId: "class-1",
  cycleId: "cycle-1",
  weekNumber: params.weekNumber,
  summary: buildSummary({
    stabilityStatus: params.stabilityStatus,
    stabilitySeverity: params.stabilitySeverity,
    authorityHasViolations: params.authorityHasViolations,
    authorityViolations: params.authorityViolations,
    coherenceOk: params.coherenceOk,
    quarter: params.quarter,
    closingType: params.closingType,
    driftCode: params.driftCode,
  }),
  capturedAt: `2026-04-${String(params.weekNumber).padStart(2, "0")}T10:00:00.000Z`,
  computedAt: `2026-04-${String(params.weekNumber).padStart(2, "0")}T12:00:00.000Z`,
});

const buildDecision = (params: {
  weekNumber: number;
  status: "accepted" | "rejected";
  code: ObservabilityRecommendationDecision["recommendationCode"];
}): ObservabilityRecommendationDecision => ({
  id: `plan-${params.weekNumber}:${params.code}`,
  classId: "class-1",
  cycleId: "cycle-1",
  planId: `plan-${params.weekNumber}`,
  weekNumber: params.weekNumber,
  recommendationCode: params.code,
  status: params.status,
  priority: "high",
  title: "Recommendation title",
  message: "Recommendation message",
  rationale: "Recommendation rationale",
  sourceSignals: ["authority_break_recurrence"],
  reasonType: params.status === "accepted" ? "accepted_without_note" : "not_relevant",
  reasonNote: null,
  createdAt: `2026-04-${String(params.weekNumber).padStart(2, "0")}T12:00:00.000Z`,
  updatedAt: `2026-04-${String(params.weekNumber).padStart(2, "0")}T12:00:00.000Z`,
});

describe("observability summaries aggregation", () => {
  it("counts attention and authority violation weeks in trend", () => {
    const records = [
      buildRecord({
        weekNumber: 1,
        stabilityStatus: "stable",
        stabilitySeverity: "low",
        authorityHasViolations: false,
      }),
      buildRecord({
        weekNumber: 2,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: true,
        driftCode: "weekly_authority_violation",
      }),
      buildRecord({
        weekNumber: 3,
        stabilityStatus: "unstable",
        stabilitySeverity: "high",
        authorityHasViolations: true,
        driftCode: "weekly_authority_violation",
      }),
    ];

    const trend = computeObservabilityTrendFromRecords(records);

    expect(trend.totalWeeks).toBe(3);
    expect(trend.attentionWeeks).toBe(1);
    expect(trend.highSeverityWeeks).toBe(1);
    expect(trend.authorityViolationWeeks).toBe(2);
  });

  it("uses stability status to determine recent unstable weeks", () => {
    const records = [
      buildRecord({
        weekNumber: 1,
        stabilityStatus: "stable",
        stabilitySeverity: "low",
        authorityHasViolations: false,
      }),
      buildRecord({
        weekNumber: 2,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: false,
        driftCode: "load_flattening",
      }),
      buildRecord({
        weekNumber: 3,
        stabilityStatus: "unstable",
        stabilitySeverity: "high",
        authorityHasViolations: true,
        driftCode: "weekly_authority_violation",
      }),
    ];

    const unstable = computeRecentUnstableWeeksFromRecords(records, 5);

    expect(unstable).toHaveLength(1);
    expect(unstable[0].weekNumber).toBe(3);
  });

  it("counts weekly authority violation in drift frequency", () => {
    const records = [
      buildRecord({
        weekNumber: 2,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: true,
        driftCode: "weekly_authority_violation",
      }),
      buildRecord({
        weekNumber: 3,
        stabilityStatus: "unstable",
        stabilitySeverity: "high",
        authorityHasViolations: true,
        driftCode: "weekly_authority_violation",
      }),
    ];

    const frequency = computeDriftFrequencyFromRecords(records);
    const authorityEntry = frequency.find((item) => item.code === "weekly_authority_violation");

    expect(authorityEntry?.total).toBe(2);
    expect(authorityEntry?.medium).toBe(1);
    expect(authorityEntry?.high).toBe(1);
  });

  it("detects recent coherence drop", () => {
    const records = [
      buildRecord({ weekNumber: 1, stabilityStatus: "stable", stabilitySeverity: "low", authorityHasViolations: false, coherenceOk: true }),
      buildRecord({ weekNumber: 2, stabilityStatus: "stable", stabilitySeverity: "low", authorityHasViolations: false, coherenceOk: true }),
      buildRecord({ weekNumber: 3, stabilityStatus: "stable", stabilitySeverity: "low", authorityHasViolations: false, coherenceOk: true }),
      buildRecord({ weekNumber: 4, stabilityStatus: "stable", stabilitySeverity: "low", authorityHasViolations: false, coherenceOk: true }),
      buildRecord({ weekNumber: 5, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: false, coherenceOk: false, driftCode: "load_flattening" }),
      buildRecord({ weekNumber: 6, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: false, coherenceOk: false, driftCode: "load_flattening" }),
      buildRecord({ weekNumber: 7, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: false, coherenceOk: false, driftCode: "repetition_excess" }),
      buildRecord({ weekNumber: 8, stabilityStatus: "unstable", stabilitySeverity: "high", authorityHasViolations: true, coherenceOk: false, driftCode: "weekly_authority_violation" }),
    ];

    const insights = buildObservabilityInsightsFromRecords(records);
    const match = insights.find((item) => item.code === "coherence_drop_recent");

    expect(match).toBeTruthy();
    expect(match?.scope).toBe("recent_window");
  });

  it("detects top recurring drift with dominant code evidence", () => {
    const records = [
      buildRecord({ weekNumber: 1, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: false, driftCode: "load_flattening" }),
      buildRecord({ weekNumber: 2, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: false, driftCode: "load_flattening" }),
      buildRecord({ weekNumber: 3, stabilityStatus: "stable", stabilitySeverity: "low", authorityHasViolations: false, driftCode: "repetition_excess" }),
    ];

    const insights = buildObservabilityInsightsFromRecords(records);
    const match = insights.find((item) => item.code === "top_recurring_drift");

    expect(match).toBeTruthy();
    expect(match?.evidence?.dominantCode).toBe("load_flattening");
  });

  it("detects quarter instability concentration", () => {
    const records = [
      buildRecord({ weekNumber: 1, stabilityStatus: "unstable", stabilitySeverity: "high", authorityHasViolations: true, quarter: "Q3", driftCode: "weekly_authority_violation" }),
      buildRecord({ weekNumber: 2, stabilityStatus: "unstable", stabilitySeverity: "high", authorityHasViolations: true, quarter: "Q3", driftCode: "weekly_authority_violation" }),
      buildRecord({ weekNumber: 3, stabilityStatus: "stable", stabilitySeverity: "low", authorityHasViolations: false, quarter: "Q3" }),
      buildRecord({ weekNumber: 4, stabilityStatus: "stable", stabilitySeverity: "low", authorityHasViolations: false, quarter: "Q3" }),
    ];

    const insights = buildObservabilityInsightsFromRecords(records);
    const match = insights.find((item) => item.code === "quarter_instability_concentration");

    expect(match).toBeTruthy();
    expect(match?.scope).toBe("current_quarter");
  });

  it("reports quarter closing consistency as info when closing type is consistent", () => {
    const records = [
      buildRecord({ weekNumber: 1, stabilityStatus: "stable", stabilitySeverity: "low", authorityHasViolations: false, quarter: "Q3", closingType: "aplicacao" }),
      buildRecord({ weekNumber: 2, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: false, quarter: "Q3", closingType: "aplicacao", driftCode: "load_flattening" }),
      buildRecord({ weekNumber: 3, stabilityStatus: "stable", stabilitySeverity: "low", authorityHasViolations: false, quarter: "Q3", closingType: "aplicacao" }),
    ];

    const insights = buildObservabilityInsightsFromRecords(records);
    const match = insights.find((item) => item.code === "quarter_closing_consistency");

    expect(match?.severity).toBe("info");
  });

  it("detects recurring authority breaks in recent weeks", () => {
    const records = [
      buildRecord({ weekNumber: 1, stabilityStatus: "stable", stabilitySeverity: "low", authorityHasViolations: false }),
      buildRecord({ weekNumber: 2, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: true, driftCode: "weekly_authority_violation" }),
      buildRecord({ weekNumber: 3, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: true, driftCode: "weekly_authority_violation" }),
      buildRecord({ weekNumber: 4, stabilityStatus: "unstable", stabilitySeverity: "high", authorityHasViolations: true, driftCode: "weekly_authority_violation" }),
    ];

    const insights = buildObservabilityInsightsFromRecords(records);
    const match = insights.find((item) => item.code === "authority_break_recurrence");

    expect(match).toBeTruthy();
    expect(match?.scope).toBe("authority");
  });

  it("detects recent stability escalation", () => {
    const records = [
      buildRecord({ weekNumber: 1, stabilityStatus: "stable", stabilitySeverity: "low", authorityHasViolations: false }),
      buildRecord({ weekNumber: 2, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: false, driftCode: "load_flattening" }),
      buildRecord({ weekNumber: 3, stabilityStatus: "unstable", stabilitySeverity: "high", authorityHasViolations: true, driftCode: "weekly_authority_violation" }),
    ];

    const insights = buildObservabilityInsightsFromRecords(records);
    const match = insights.find((item) => item.code === "stability_escalation_recent");

    expect(match).toBeTruthy();
    expect(match?.severity).toBe("critical");
  });

  it("generates high-priority recommendation for recurring authority breaks", () => {
    const records = [
      buildRecord({ weekNumber: 1, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: true, driftCode: "weekly_authority_violation" }),
      buildRecord({ weekNumber: 2, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: true, driftCode: "weekly_authority_violation" }),
      buildRecord({ weekNumber: 3, stabilityStatus: "unstable", stabilitySeverity: "high", authorityHasViolations: true, driftCode: "weekly_authority_violation" }),
    ];

    const recommendations = buildObservabilityRecommendationsFromRecords(records);
    const match = recommendations.find((item) => item.code === "restore_weekly_role_alignment");

    expect(match).toBeTruthy();
    expect(match?.priority).toBe("high");
  });

  it("generates technical isolation recommendation from authority violation code", () => {
    const records = [
      buildRecord({
        weekNumber: 1,
        stabilityStatus: "unstable",
        stabilitySeverity: "high",
        authorityHasViolations: true,
        authorityViolations: ["pure_technical_isolation_not_allowed"],
        driftCode: "weekly_authority_violation",
      }),
      buildRecord({
        weekNumber: 2,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: true,
        authorityViolations: ["pure_technical_isolation_not_allowed"],
        driftCode: "weekly_authority_violation",
      }),
    ];

    const recommendations = buildObservabilityRecommendationsFromRecords(records);

    expect(recommendations.some((item) => item.code === "reduce_technical_isolation")).toBe(true);
  });

  it("generates medium recommendation for repetition excess drift", () => {
    const records = [
      buildRecord({ weekNumber: 1, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: false, driftCode: "repetition_excess" }),
      buildRecord({ weekNumber: 2, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: false, driftCode: "repetition_excess" }),
    ];

    const recommendations = buildObservabilityRecommendationsFromRecords(records);
    const match = recommendations.find(
      (item) => item.code === "reduce_repetition_with_controlled_variation"
    );

    expect(match?.priority).toBe("medium");
  });

  it("generates medium recommendation for load flattening drift", () => {
    const records = [
      buildRecord({ weekNumber: 1, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: false, driftCode: "load_flattening" }),
      buildRecord({ weekNumber: 2, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: false, driftCode: "load_flattening" }),
    ];

    const recommendations = buildObservabilityRecommendationsFromRecords(records);
    const match = recommendations.find((item) => item.code === "rebalance_load_progression");

    expect(match?.priority).toBe("medium");
  });

  it("generates review recommendation when stability escalates", () => {
    const records = [
      buildRecord({ weekNumber: 1, stabilityStatus: "stable", stabilitySeverity: "low", authorityHasViolations: false }),
      buildRecord({ weekNumber: 2, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: false, driftCode: "load_flattening" }),
      buildRecord({ weekNumber: 3, stabilityStatus: "unstable", stabilitySeverity: "high", authorityHasViolations: true, driftCode: "weekly_authority_violation" }),
    ];

    const recommendations = buildObservabilityRecommendationsFromRecords(records);
    const match = recommendations.find((item) => item.code === "review_recent_week_design");

    expect(match).toBeTruthy();
    expect(match?.priority).toBe("high");
  });

  it("orders recommendations by priority", () => {
    const records = [
      buildRecord({
        weekNumber: 1,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: true,
        authorityViolations: ["progression_outside_weekly_role"],
        driftCode: "load_flattening",
      }),
      buildRecord({
        weekNumber: 2,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: true,
        authorityViolations: ["progression_outside_weekly_role"],
        driftCode: "load_flattening",
      }),
      buildRecord({
        weekNumber: 3,
        stabilityStatus: "unstable",
        stabilitySeverity: "high",
        authorityHasViolations: true,
        authorityViolations: ["progression_outside_weekly_role"],
        driftCode: "load_flattening",
      }),
    ];

    const recommendations = buildObservabilityRecommendationsFromRecords(records);
    const firstMediumIndex = recommendations.findIndex((item) => item.priority === "medium");
    const lastHighIndex = recommendations
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.priority === "high")
      .reduce((max, current) => Math.max(max, current.index), -1);

    expect(lastHighIndex).toBeGreaterThanOrEqual(0);
    expect(firstMediumIndex).toBeGreaterThan(lastHighIndex);
  });

  it("deduplicates recommendations generated by multiple overlapping signals", () => {
    const records = [
      buildRecord({ weekNumber: 1, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: true, driftCode: "weekly_authority_violation" }),
      buildRecord({ weekNumber: 2, stabilityStatus: "attention", stabilitySeverity: "medium", authorityHasViolations: true, driftCode: "weekly_authority_violation" }),
      buildRecord({ weekNumber: 3, stabilityStatus: "unstable", stabilitySeverity: "high", authorityHasViolations: true, driftCode: "weekly_authority_violation" }),
    ];

    const recommendations = buildObservabilityRecommendationsFromRecords(records);
    const roleAlignment = recommendations.filter(
      (item) => item.code === "restore_weekly_role_alignment"
    );

    expect(roleAlignment).toHaveLength(1);
  });

  it("builds improved evidence when following weeks recover stability", () => {
    const records = [
      buildRecord({
        weekNumber: 1,
        stabilityStatus: "unstable",
        stabilitySeverity: "high",
        authorityHasViolations: true,
        driftCode: "weekly_authority_violation",
      }),
      buildRecord({
        weekNumber: 2,
        stabilityStatus: "stable",
        stabilitySeverity: "low",
        authorityHasViolations: false,
      }),
      buildRecord({
        weekNumber: 3,
        stabilityStatus: "stable",
        stabilitySeverity: "low",
        authorityHasViolations: false,
      }),
    ];

    const evidence = buildRecommendationEvidenceFromRecords({
      decisions: [buildDecision({ weekNumber: 1, status: "accepted", code: "restore_weekly_role_alignment" })],
      records,
      lookaheadWeeks: 2,
    });

    expect(evidence[0]?.outcome).toBe("improved");
  });

  it("builds worsened evidence when following weeks degrade", () => {
    const records = [
      buildRecord({
        weekNumber: 1,
        stabilityStatus: "stable",
        stabilitySeverity: "low",
        authorityHasViolations: false,
      }),
      buildRecord({
        weekNumber: 2,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: true,
        driftCode: "weekly_authority_violation",
      }),
      buildRecord({
        weekNumber: 3,
        stabilityStatus: "unstable",
        stabilitySeverity: "high",
        authorityHasViolations: true,
        driftCode: "weekly_authority_violation",
      }),
    ];

    const evidence = buildRecommendationEvidenceFromRecords({
      decisions: [buildDecision({ weekNumber: 1, status: "accepted", code: "restore_weekly_role_alignment" })],
      records,
      lookaheadWeeks: 2,
    });

    expect(evidence[0]?.outcome).toBe("worsened");
  });

  it("builds unchanged evidence when following weeks stay neutral", () => {
    const records = [
      buildRecord({
        weekNumber: 1,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: false,
        coherenceOk: false,
        driftCode: "load_flattening",
      }),
      buildRecord({
        weekNumber: 2,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: false,
        coherenceOk: false,
        driftCode: "load_flattening",
      }),
      buildRecord({
        weekNumber: 3,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: false,
        coherenceOk: false,
        driftCode: "load_flattening",
      }),
    ];

    const evidence = buildRecommendationEvidenceFromRecords({
      decisions: [buildDecision({ weekNumber: 1, status: "rejected", code: "rebalance_load_progression" })],
      records,
      lookaheadWeeks: 2,
    });

    expect(evidence[0]?.outcome).toBe("unchanged");
  });

  it("builds insufficient evidence when future weeks are missing", () => {
    const records = [
      buildRecord({
        weekNumber: 1,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: true,
        driftCode: "weekly_authority_violation",
      }),
      buildRecord({
        weekNumber: 2,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: true,
        driftCode: "weekly_authority_violation",
      }),
    ];

    const evidence = buildRecommendationEvidenceFromRecords({
      decisions: [buildDecision({ weekNumber: 1, status: "accepted", code: "restore_weekly_role_alignment" })],
      records,
      lookaheadWeeks: 2,
    });

    expect(evidence[0]?.outcome).toBe("insufficient_evidence");
  });

  it("aggregates recommendation family counts", () => {
    const decisions = [
      buildDecision({ weekNumber: 1, status: "accepted", code: "restore_weekly_role_alignment" }),
      buildDecision({ weekNumber: 2, status: "accepted", code: "restore_weekly_role_alignment" }),
      buildDecision({ weekNumber: 3, status: "rejected", code: "restore_weekly_role_alignment" }),
    ];
    const evidence = [
      {
        recommendationCode: "restore_weekly_role_alignment" as const,
        decisionStatus: "accepted" as const,
        baselineWeekNumber: 1,
        comparedWeeks: [2, 3],
        outcome: "improved" as const,
        rationale: "melhorou",
      },
      {
        recommendationCode: "restore_weekly_role_alignment" as const,
        decisionStatus: "accepted" as const,
        baselineWeekNumber: 2,
        comparedWeeks: [3, 4],
        outcome: "unchanged" as const,
        rationale: "estavel",
      },
      {
        recommendationCode: "restore_weekly_role_alignment" as const,
        decisionStatus: "rejected" as const,
        baselineWeekNumber: 3,
        comparedWeeks: [4],
        outcome: "insufficient_evidence" as const,
        rationale: "insuficiente",
      },
    ];

    const aggregates = buildRecommendationFamilyAggregates({ decisions, evidence });

    expect(aggregates).toHaveLength(1);
    expect(aggregates[0]?.totalSuggested).toBe(3);
    expect(aggregates[0]?.totalAccepted).toBe(2);
    expect(aggregates[0]?.totalRejected).toBe(1);
    expect(aggregates[0]?.improvedCount).toBe(1);
    expect(aggregates[0]?.unchangedCount).toBe(1);
    expect(aggregates[0]?.insufficientEvidenceCount).toBe(1);
  });

  it("sets low confidence with insufficient observed outcomes", () => {
    const aggregates = buildRecommendationFamilyAggregates({
      decisions: [
        buildDecision({ weekNumber: 1, status: "accepted", code: "restore_weekly_role_alignment" }),
      ],
      evidence: [
        {
          recommendationCode: "restore_weekly_role_alignment",
          decisionStatus: "accepted",
          baselineWeekNumber: 1,
          comparedWeeks: [2],
          outcome: "insufficient_evidence",
          rationale: "insuficiente",
        },
      ],
    });

    expect(aggregates[0]?.confidence).toBe("low");
  });

  it("sets medium confidence when observed outcomes are mixed", () => {
    const aggregates = buildRecommendationFamilyAggregates({
      decisions: [
        buildDecision({ weekNumber: 1, status: "accepted", code: "restore_weekly_role_alignment" }),
        buildDecision({ weekNumber: 2, status: "accepted", code: "restore_weekly_role_alignment" }),
        buildDecision({ weekNumber: 3, status: "rejected", code: "restore_weekly_role_alignment" }),
      ],
      evidence: [
        {
          recommendationCode: "restore_weekly_role_alignment",
          decisionStatus: "accepted",
          baselineWeekNumber: 1,
          comparedWeeks: [2, 3],
          outcome: "improved",
          rationale: "melhorou",
        },
        {
          recommendationCode: "restore_weekly_role_alignment",
          decisionStatus: "accepted",
          baselineWeekNumber: 2,
          comparedWeeks: [3, 4],
          outcome: "unchanged",
          rationale: "estavel",
        },
        {
          recommendationCode: "restore_weekly_role_alignment",
          decisionStatus: "rejected",
          baselineWeekNumber: 3,
          comparedWeeks: [4, 5],
          outcome: "worsened",
          rationale: "piorou",
        },
      ],
    });

    expect(aggregates[0]?.confidence).toBe("medium");
  });

  it("sets high confidence when observed outcomes are dominantly consistent", () => {
    const aggregates = buildRecommendationFamilyAggregates({
      decisions: [
        buildDecision({ weekNumber: 1, status: "accepted", code: "restore_weekly_role_alignment" }),
        buildDecision({ weekNumber: 2, status: "accepted", code: "restore_weekly_role_alignment" }),
        buildDecision({ weekNumber: 3, status: "accepted", code: "restore_weekly_role_alignment" }),
        buildDecision({ weekNumber: 4, status: "accepted", code: "restore_weekly_role_alignment" }),
      ],
      evidence: [
        {
          recommendationCode: "restore_weekly_role_alignment",
          decisionStatus: "accepted",
          baselineWeekNumber: 1,
          comparedWeeks: [2, 3],
          outcome: "improved",
          rationale: "melhorou",
        },
        {
          recommendationCode: "restore_weekly_role_alignment",
          decisionStatus: "accepted",
          baselineWeekNumber: 2,
          comparedWeeks: [3, 4],
          outcome: "improved",
          rationale: "melhorou",
        },
        {
          recommendationCode: "restore_weekly_role_alignment",
          decisionStatus: "accepted",
          baselineWeekNumber: 3,
          comparedWeeks: [4, 5],
          outcome: "improved",
          rationale: "melhorou",
        },
        {
          recommendationCode: "restore_weekly_role_alignment",
          decisionStatus: "accepted",
          baselineWeekNumber: 4,
          comparedWeeks: [5, 6],
          outcome: "unchanged",
          rationale: "estavel",
        },
      ],
    });

    expect(aggregates[0]?.confidence).toBe("high");
  });

  it("ranks recommendations by base priority plus observational confidence bonus", () => {
    const ranked = buildRankedRecommendations({
      recommendations: [
        {
          code: "rebalance_load_progression",
          priority: "medium",
          action: "adjust_next_week",
          title: "Rebalancear progressao",
          message: "Ajustar carga.",
          rationale: "Drift de carga recorrente.",
          sourceSignals: ["top_recurring_drift"],
        },
        {
          code: "restore_weekly_role_alignment",
          priority: "high",
          action: "review_current_week",
          title: "Restaurar alinhamento",
          message: "Revisar desenho semanal.",
          rationale: "Quebras de autoridade recorrentes.",
          sourceSignals: ["authority_break_recurrence"],
        },
      ],
      aggregates: [
        {
          recommendationCode: "rebalance_load_progression",
          totalSuggested: 4,
          totalAccepted: 3,
          totalRejected: 1,
          improvedCount: 3,
          unchangedCount: 1,
          worsenedCount: 0,
          insufficientEvidenceCount: 0,
          confidence: "high",
        },
        {
          recommendationCode: "restore_weekly_role_alignment",
          totalSuggested: 2,
          totalAccepted: 1,
          totalRejected: 1,
          improvedCount: 0,
          unchangedCount: 1,
          worsenedCount: 1,
          insufficientEvidenceCount: 0,
          confidence: "low",
        },
      ],
    });

    expect(ranked[0]?.recommendation.code).toBe("restore_weekly_role_alignment");
    expect(ranked[0]?.rankingScore).toBe(30);
    expect(ranked[0]?.rankingReason).toBe("held_by_low_confidence");
    expect(ranked[1]?.recommendation.code).toBe("rebalance_load_progression");
    expect(ranked[1]?.rankingScore).toBe(25);
    expect(ranked[1]?.rankingReason).toBe("boosted_by_high_confidence");
  });

  it("falls back to low confidence and base-priority ranking reason when aggregate is missing", () => {
    const ranked = buildRankedRecommendations({
      recommendations: [
        {
          code: "increase_contextual_decision_density",
          priority: "low",
          action: "monitor_next_two_weeks",
          title: "Aumentar densidade decisional",
          message: "Inserir mais leitura de jogo.",
          rationale: "Baixa densidade observada.",
          sourceSignals: ["stability_escalation_recent"],
        },
      ],
      aggregates: [],
    });

    expect(ranked[0]?.confidence).toBe("low");
    expect(ranked[0]?.rankingScore).toBe(10);
    expect(ranked[0]?.rankingReason).toBe("base_priority_only");
  });

  it("uses stable sort fallback by recommendation code when scores tie", () => {
    const ranked = buildRankedRecommendations({
      recommendations: [
        {
          code: "reduce_repetition_with_controlled_variation",
          priority: "medium",
          action: "adjust_next_week",
          title: "Reduzir repeticao",
          message: "Variar mantendo objetivo.",
          rationale: "Repeticao excessiva.",
          sourceSignals: ["top_recurring_drift"],
        },
        {
          code: "rebalance_load_progression",
          priority: "medium",
          action: "adjust_next_week",
          title: "Rebalancear carga",
          message: "Ajustar progressao.",
          rationale: "Carga achatada.",
          sourceSignals: ["top_recurring_drift"],
        },
      ],
      aggregates: [],
    });

    expect(ranked[0]?.recommendation.code).toBe("rebalance_load_progression");
    expect(ranked[1]?.recommendation.code).toBe("reduce_repetition_with_controlled_variation");
    expect(ranked[0]?.rankingReason).toBe("base_priority_only");
    expect(ranked[1]?.rankingReason).toBe("base_priority_only");
  });

  it("marks history as favorable when confidence is high and improved dominates", () => {
    const informed = buildConfidenceInformedRecommendations({
      recommendations: [
        {
          code: "restore_weekly_role_alignment",
          priority: "high",
          action: "review_current_week",
          title: "Restaurar alinhamento",
          message: "Revisar desenho semanal.",
          rationale: "Quebras recorrentes.",
          sourceSignals: ["authority_break_recurrence"],
        },
      ],
      aggregates: [
        {
          recommendationCode: "restore_weekly_role_alignment",
          totalSuggested: 6,
          totalAccepted: 4,
          totalRejected: 2,
          improvedCount: 4,
          unchangedCount: 1,
          worsenedCount: 1,
          insufficientEvidenceCount: 0,
          confidence: "high",
        },
      ],
    });

    expect(informed[0]?.framing).toBe("history_favorable");
    expect(informed[0]?.presentation.tone).toBe("reinforced");
    expect(informed[0]?.familyPresentation.family).toBe("weekly_alignment");
    expect(informed[0]?.familyPresentation.familyLabel).toBe("Alinhamento semanal");
  });

  it("marks history as unfavorable when confidence is high and worsened dominates", () => {
    const informed = buildConfidenceInformedRecommendations({
      recommendations: [
        {
          code: "rebalance_load_progression",
          priority: "medium",
          action: "adjust_next_week",
          title: "Rebalancear carga",
          message: "Ajustar progressao.",
          rationale: "Carga achatada.",
          sourceSignals: ["top_recurring_drift"],
        },
      ],
      aggregates: [
        {
          recommendationCode: "rebalance_load_progression",
          totalSuggested: 5,
          totalAccepted: 3,
          totalRejected: 2,
          improvedCount: 1,
          unchangedCount: 1,
          worsenedCount: 3,
          insufficientEvidenceCount: 0,
          confidence: "high",
        },
      ],
    });

    expect(informed[0]?.framing).toBe("history_unfavorable");
    expect(informed[0]?.presentation.tone).toBe("cautious");
    expect(informed[0]?.familyPresentation.family).toBe("load_progression");
    expect(informed[0]?.familyPresentation.familyHelperText).toBe(
      "Ha sinais de carga achatada ou contraste insuficiente."
    );
  });

  it("marks history as inconclusive when confidence is low", () => {
    const informed = buildConfidenceInformedRecommendations({
      recommendations: [
        {
          code: "reduce_repetition_with_controlled_variation",
          priority: "medium",
          action: "adjust_next_week",
          title: "Reduzir repeticao",
          message: "Variar mantendo objetivo.",
          rationale: "Repeticao excessiva.",
          sourceSignals: ["top_recurring_drift"],
        },
      ],
      aggregates: [
        {
          recommendationCode: "reduce_repetition_with_controlled_variation",
          totalSuggested: 2,
          totalAccepted: 1,
          totalRejected: 1,
          improvedCount: 1,
          unchangedCount: 0,
          worsenedCount: 0,
          insufficientEvidenceCount: 1,
          confidence: "low",
        },
      ],
    });

    expect(informed[0]?.framing).toBe("history_inconclusive");
    expect(informed[0]?.presentation.tone).toBe("neutral");
    expect(informed[0]?.familyPresentation.family).toBe("repetition_control");
  });

  it("keeps ranking metadata together with family presentation", () => {
    const ranked = buildRankedRecommendations({
      recommendations: [
        {
          code: "increase_game_transfer",
          priority: "medium",
          action: "adjust_next_week",
          title: "Aumentar transferencia",
          message: "Mais leitura de jogo.",
          rationale: "Transferencia baixa.",
          sourceSignals: ["game_transfer_below_weekly_role_minimum"],
        },
      ],
      aggregates: [],
    });

    expect(ranked[0]?.rankingReason).toBe("base_priority_only");
    expect(ranked[0]?.familyPresentation.family).toBe("game_transfer");
    expect(ranked[0]?.familyPresentation.familyLabel).toBe("Transferencia para jogo");
  });

  it("builds dominant problem family summary from ranked recommendations", () => {
    const ranked = buildRankedRecommendations({
      recommendations: [
        {
          code: "restore_weekly_role_alignment",
          priority: "high",
          action: "review_current_week",
          title: "Restaurar alinhamento",
          message: "Revisar desenho semanal.",
          rationale: "Quebras de autoridade recorrentes.",
          sourceSignals: ["authority_break_recurrence"],
        },
        {
          code: "restore_weekly_role_alignment",
          priority: "high",
          action: "adjust_next_week",
          title: "Restaurar alinhamento (variacao)",
          message: "Revisar microdecisoes da semana.",
          rationale: "Persistencia de quebras de autoridade.",
          sourceSignals: ["authority_break_recurrence"],
        },
        {
          code: "rebalance_load_progression",
          priority: "medium",
          action: "adjust_next_week",
          title: "Rebalancear carga",
          message: "Ajustar progressao.",
          rationale: "Carga achatada.",
          sourceSignals: ["top_recurring_drift"],
        },
      ],
      aggregates: [
        {
          recommendationCode: "restore_weekly_role_alignment",
          totalSuggested: 6,
          totalAccepted: 4,
          totalRejected: 2,
          improvedCount: 4,
          unchangedCount: 1,
          worsenedCount: 1,
          insufficientEvidenceCount: 0,
          confidence: "high",
        },

      ],
    });

    const summary = buildRecommendationProblemFamilySummary({
      rankedRecommendations: ranked,
    });

    expect(summary.dominantFamily).toBe("weekly_alignment");
    expect(summary.dominantFamilyLabel).toBe("Alinhamento semanal");
    expect(summary.cohorts[0]?.recommendationsCount).toBe(2);
    expect(summary.cohorts[0]?.highPriorityCount).toBe(2);
  });

  it("uses high-priority tie-break when family counts are tied", () => {
    const ranked = buildRankedRecommendations({
      recommendations: [
        {
          code: "restore_weekly_role_alignment",
          priority: "high",
          action: "review_current_week",
          title: "Restaurar alinhamento",
          message: "Revisar desenho semanal.",
          rationale: "Quebras de autoridade recorrentes.",
          sourceSignals: ["authority_break_recurrence"],
        },
        {
          code: "rebalance_load_progression",
          priority: "medium",
          action: "adjust_next_week",
          title: "Rebalancear carga",
          message: "Ajustar progressao.",
          rationale: "Carga achatada.",
          sourceSignals: ["top_recurring_drift"],
        },
      ],
      aggregates: [],
    });

    const summary = buildRecommendationProblemFamilySummary({
      rankedRecommendations: ranked,
    });

    expect(summary.dominantFamily).toBe("weekly_alignment");
    expect(summary.cohorts[0]?.recommendationsCount).toBe(1);
    expect(summary.cohorts[0]?.highPriorityCount).toBe(1);
    expect(summary.cohorts[1]?.recommendationsCount).toBe(1);
    expect(summary.cohorts[1]?.highPriorityCount).toBe(0);
  });

  it("builds isolated axis summary when only dominant family exists", () => {
    const familySummary = {
      dominantFamily: "weekly_alignment" as const,
      dominantFamilyLabel: "Alinhamento semanal",
      cohorts: [
        {
          family: "weekly_alignment" as const,
          familyLabel: "Alinhamento semanal",
          familyHelperText: "Problemas entre papel da semana e execucao das sessoes.",
          recommendationsCount: 2,
          highPriorityCount: 2,
          cautiousCount: 0,
        },
      ],
    };

    const axis = buildRecommendationProblemAxisSummary({ familySummary });

    expect(axis?.dominantFamily).toBe("weekly_alignment");
    expect(axis?.secondaryFamily).toBeNull();
    expect(axis?.tension).toBe("isolated");
    expect(axis?.summary).toContain("sem concorrencia forte de outro eixo");
  });

  it("builds reinforcing axis summary when pair is compatible", () => {
    const familySummary = {
      dominantFamily: "weekly_alignment" as const,
      dominantFamilyLabel: "Alinhamento semanal",
      cohorts: [
        {
          family: "weekly_alignment" as const,
          familyLabel: "Alinhamento semanal",
          familyHelperText: "Problemas entre papel da semana e execucao das sessoes.",
          recommendationsCount: 3,
          highPriorityCount: 2,
          cautiousCount: 1,
        },
        {
          family: "quarter_closing" as const,
          familyLabel: "Fechamento trimestral",
          familyHelperText: "O momento do trimestre ainda nao esta perceptivel na pratica.",
          recommendationsCount: 1,
          highPriorityCount: 0,
          cautiousCount: 0,
        },
      ],
    };

    const axis = buildRecommendationProblemAxisSummary({ familySummary });

    expect(axis?.secondaryFamily).toBe("quarter_closing");
    expect(axis?.tension).toBe("reinforcing");
    expect(axis?.summary).toContain("reforcado por Fechamento trimestral");
  });

  it("builds competing axis summary when pair is in tension", () => {
    const familySummary = {
      dominantFamily: "load_progression" as const,
      dominantFamilyLabel: "Progressao de carga",
      cohorts: [
        {
          family: "load_progression" as const,
          familyLabel: "Progressao de carga",
          familyHelperText: "Ha sinais de carga achatada ou contraste insuficiente.",
          recommendationsCount: 2,
          highPriorityCount: 1,
          cautiousCount: 1,
        },
        {
          family: "weekly_alignment" as const,
          familyLabel: "Alinhamento semanal",
          familyHelperText: "Problemas entre papel da semana e execucao das sessoes.",
          recommendationsCount: 1,
          highPriorityCount: 1,
          cautiousCount: 0,
        },
      ],
    };

    const axis = buildRecommendationProblemAxisSummary({ familySummary });

    expect(axis?.secondaryFamily).toBe("weekly_alignment");
    expect(axis?.tension).toBe("competing");
    expect(axis?.summary).toContain("tensao observacional com Alinhamento semanal");
  });

  it("builds problem-family timeline by week", () => {
    const records = [
      buildRecord({
        weekNumber: 1,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: false,
        driftCode: "load_flattening",
      }),
      buildRecord({
        weekNumber: 2,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: false,
        driftCode: "repetition_excess",
      }),
      buildRecord({
        weekNumber: 3,
        stabilityStatus: "attention",
        stabilitySeverity: "medium",
        authorityHasViolations: true,
        driftCode: "weekly_authority_violation",
      }),
    ];

    const timeline = buildRecommendationProblemFamilyTimeline({ records });

    expect(timeline.length).toBeGreaterThanOrEqual(2);
    expect(timeline[0]?.weekNumber).toBeLessThan(timeline[timeline.length - 1]?.weekNumber ?? 99);
    expect(timeline.every((item) => item.dominantLabel.length > 0)).toBe(true);
  });

  it("builds stable axis transition summary", () => {
    const timeline = [
      { weekNumber: 12, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 13, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 14, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
    ];

    const transition = buildRecommendationAxisTransitionSummary({ timeline });

    expect(transition?.transitionType).toBe("stable_axis");
    expect(transition?.summary).toContain("permaneceu em Alinhamento semanal");
  });

  it("builds axis-shift transition summary", () => {
    const timeline = [
      { weekNumber: 12, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 13, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 14, dominantFamily: "quarter_closing" as const, dominantLabel: "Fechamento trimestral" },
    ];

    const transition = buildRecommendationAxisTransitionSummary({ timeline });

    expect(transition?.transitionType).toBe("axis_shift");
    expect(transition?.summary).toContain("mudou recentemente de Alinhamento semanal para Fechamento trimestral");
  });

  it("builds axis-rotation transition summary", () => {
    const timeline = [
      { weekNumber: 12, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 13, dominantFamily: "load_progression" as const, dominantLabel: "Progressao de carga" },
      { weekNumber: 14, dominantFamily: "game_transfer" as const, dominantLabel: "Transferencia para jogo" },
      { weekNumber: 15, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
    ];

    const transition = buildRecommendationAxisTransitionSummary({ timeline });

    expect(transition?.transitionType).toBe("axis_rotation");
    expect(transition?.summary).toContain("oscilando entre multiplos eixos");
  });
});

describe("buildRecommendationAxisPersistenceSummary", () => {
  it("returns null for timeline shorter than 2 weeks", () => {
    const result = buildRecommendationAxisPersistenceSummary({
      timeline: [{ weekNumber: 1, dominantFamily: "weekly_alignment", dominantLabel: "Alinhamento semanal" }],
    });
    expect(result).toBeNull();
  });

  it("returns stable_persistence when dominant family holds >= 70% of weeks", () => {
    const timeline = [
      { weekNumber: 1, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 2, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 3, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 4, dominantFamily: "quarter_closing" as const, dominantLabel: "Fechamento trimestral" },
    ];
    const result = buildRecommendationAxisPersistenceSummary({ timeline });
    expect(result?.persistenceType).toBe("stable_persistence");
    expect(result?.earlyWarning).toBe("none");
    expect(result?.dominantLabel).toBe("Alinhamento semanal");
    expect(result?.summary).toContain("manteve dominancia consistente");
  });

  it("returns unstable_rotation when 3+ distinct families and dominant < 50%", () => {
    const timeline = [
      { weekNumber: 1, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 2, dominantFamily: "load_progression" as const, dominantLabel: "Progressao de carga" },
      { weekNumber: 3, dominantFamily: "game_transfer" as const, dominantLabel: "Transferencia para jogo" },
      { weekNumber: 4, dominantFamily: "quarter_closing" as const, dominantLabel: "Fechamento trimestral" },
    ];
    const result = buildRecommendationAxisPersistenceSummary({ timeline });
    expect(result?.persistenceType).toBe("unstable_rotation");
    expect(result?.earlyWarning).toBe("warning");
    expect(result?.summary).toContain("rotacao instavel");
  });

  it("returns mixed_persistence for 2 competing families", () => {
    const timeline = [
      { weekNumber: 1, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 2, dominantFamily: "quarter_closing" as const, dominantLabel: "Fechamento trimestral" },
      { weekNumber: 3, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 4, dominantFamily: "quarter_closing" as const, dominantLabel: "Fechamento trimestral" },
    ];
    const result = buildRecommendationAxisPersistenceSummary({ timeline });
    expect(result?.persistenceType).toBe("mixed_persistence");
    expect(result?.earlyWarning).toBe("attention");
    expect(result?.summary).toContain("predominante, mas com oscilacoes");
  });

  it("unstable_rotation with fewer than 4 weeks yields attention not warning", () => {
    const timeline = [
      { weekNumber: 1, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 2, dominantFamily: "load_progression" as const, dominantLabel: "Progressao de carga" },
      { weekNumber: 3, dominantFamily: "game_transfer" as const, dominantLabel: "Transferencia para jogo" },
    ];
    const result = buildRecommendationAxisPersistenceSummary({ timeline });
    expect(result?.persistenceType).toBe("unstable_rotation");
    expect(result?.earlyWarning).toBe("attention");
  });
});

describe("buildRecommendationQADigest", () => {
  const axisSummary = {
    dominantFamily: "weekly_alignment" as const,
    dominantLabel: "Alinhamento semanal",
    secondaryFamily: "quarter_closing" as const,
    secondaryLabel: "Fechamento trimestral",
    tension: "reinforcing" as const,
    summary: "",
  };
  const persistenceSummary = {
    persistenceType: "mixed_persistence" as const,
    earlyWarning: "attention" as const,
    dominantFamily: "weekly_alignment" as const,
    dominantLabel: "Alinhamento semanal",
    weeksAnalyzed: 4,
    summary: "",
  };

  it("includes dominant axis, tension, persistence, warning, and rec focus in summary", () => {
    const result = buildRecommendationQADigest({
      axisSummary,
      persistenceSummary,
      rankedRecommendations: [
        {
          recommendation: {
            code: "restore_weekly_role_alignment",
            priority: "high",
            action: "review_current_week",
            title: "Restaurar alinhamento",
            message: "",
            rationale: "",
            sourceSignals: [],
          },
          confidence: "high",
          framing: "history_favorable",
          framingMessage: "",
          presentation: { tone: "reinforced", shortLabel: "", helperText: "" },
          familyPresentation: { family: "weekly_alignment", familyLabel: "Alinhamento semanal", familyHelperText: "" },
          rankingScore: 35,
          rankingReason: "boosted_by_high_confidence",
        },
      ],
    });
    expect(result.dominantAxisLabel).toBe("Alinhamento semanal");
    expect(result.tension).toBe("reinforcing");
    expect(result.persistenceType).toBe("mixed_persistence");
    expect(result.earlyWarning).toBe("attention");
    expect(result.recommendationFocus).toBe("Restaurar alinhamento");
    expect(result.summary).toContain("eixo dominante: Alinhamento semanal");
    expect(result.summary).toContain("persistencia: mixed_persistence");
    expect(result.summary).toContain("alerta: attention");
  });

  it("returns fallback summary when no data available", () => {
    const result = buildRecommendationQADigest({
      axisSummary: null,
      persistenceSummary: null,
      rankedRecommendations: [],
    });
    expect(result.dominantAxisLabel).toBeNull();
    expect(result.summary).toBe("Dados insuficientes para digest.");
  });
});

describe("buildRecommendationWindowComparisonSummary", () => {
  it("returns null for timeline shorter than 2", () => {
    const result = buildRecommendationWindowComparisonSummary({
      timeline: [{ weekNumber: 1, dominantFamily: "weekly_alignment", dominantLabel: "Alinhamento semanal" }],
    });
    expect(result).toBeNull();
  });

  it("detects acute problem when short and medium windows diverge", () => {
    const timeline = [
      { weekNumber: 1, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 2, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 3, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 4, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 5, dominantFamily: "load_progression" as const, dominantLabel: "Progressao de carga" },
      { weekNumber: 6, dominantFamily: "load_progression" as const, dominantLabel: "Progressao de carga" },
      { weekNumber: 7, dominantFamily: "load_progression" as const, dominantLabel: "Progressao de carga" },
    ];
    const result = buildRecommendationWindowComparisonSummary({ timeline, shortWindowSize: 3, mediumWindowSize: 7 });
    expect(result?.divergence).toBe("different_axis");
    expect(result?.interpretation).toBe("acute");
    expect(result?.summary).toContain("oscilacao aguda");
  });

  it("detects structural pattern when both windows share stable axis", () => {
    const timeline = [
      { weekNumber: 1, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 2, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 3, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 4, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 5, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 6, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
      { weekNumber: 7, dominantFamily: "weekly_alignment" as const, dominantLabel: "Alinhamento semanal" },
    ];
    const result = buildRecommendationWindowComparisonSummary({ timeline, shortWindowSize: 3, mediumWindowSize: 7 });
    expect(result?.divergence).toBe("same_axis");
    expect(result?.interpretation).toBe("structural");
    expect(result?.summary).toContain("padrao estrutural");
  });
});

describe("buildRecommendationAxisAlignmentSummary", () => {
  const baseAxisSummary = {
    dominantFamily: "weekly_alignment" as const,
    dominantLabel: "Alinhamento semanal",
    secondaryFamily: "quarter_closing" as const,
    secondaryLabel: "Fechamento trimestral",
    tension: "reinforcing" as const,
    summary: "",
  };

  const makeRec = (family: string, familyLabel: string) => [{
    recommendation: { code: "r1", priority: "high" as const, action: "review_current_week" as const, title: "", message: "", rationale: "", sourceSignals: [] },
    confidence: "high" as const,
    framing: "history_favorable" as const,
    framingMessage: "",
    presentation: { tone: "reinforced" as const, shortLabel: "", helperText: "" },
    familyPresentation: { family: family as any, familyLabel, familyHelperText: "" },
    rankingScore: 35,
    rankingReason: "boosted_by_high_confidence" as const,
  }];

  it("returns null when no axis summary", () => {
    const result = buildRecommendationAxisAlignmentSummary({ axisSummary: null, rankedRecommendations: [] });
    expect(result).toBeNull();
  });

  it("detects convergent when rec family matches dominant axis", () => {
    const result = buildRecommendationAxisAlignmentSummary({
      axisSummary: baseAxisSummary,
      rankedRecommendations: makeRec("weekly_alignment", "Alinhamento semanal"),
    });
    expect(result?.alignmentType).toBe("convergent");
    expect(result?.summary).toContain("alinhado com o eixo dominante");
  });

  it("detects partially_convergent when rec family matches secondary axis", () => {
    const result = buildRecommendationAxisAlignmentSummary({
      axisSummary: baseAxisSummary,
      rankedRecommendations: makeRec("quarter_closing", "Fechamento trimestral"),
    });
    expect(result?.alignmentType).toBe("partially_convergent");
    expect(result?.summary).toContain("eixo secundario");
  });

  it("detects divergent when rec family is unrelated to both axes", () => {
    const result = buildRecommendationAxisAlignmentSummary({
      axisSummary: baseAxisSummary,
      rankedRecommendations: makeRec("game_transfer", "Transferencia para jogo"),
    });
    expect(result?.alignmentType).toBe("divergent");
    expect(result?.summary).toContain("diverge do eixo dominante");
  });
});
