import type {
    ConfidenceInformedRecommendation,
    ObservabilityRecommendation,
    ObservabilityRecommendationDecision,
    PedagogicalDriftCode,
    RankedObservabilityRecommendation,
    RecommendationAxisAlignmentSummary,
    RecommendationAxisAlignmentType,
    RecommendationAxisEarlyWarning,
    RecommendationAxisPersistenceSummary,
    RecommendationAxisPersistenceType,
    RecommendationAxisTransitionSummary,
    RecommendationAxisTransitionType,
    RecommendationConfidenceFraming,
    RecommendationEvidence,
    RecommendationEvidenceOutcome,
    RecommendationFamilyAggregate,
    RecommendationFamilyPresentation,
    RecommendationObservationalConfidence,
    RecommendationPresentation,
    RecommendationProblemAxisSummary,
    RecommendationProblemFamily,
    RecommendationProblemFamilyCohort,
    RecommendationProblemFamilySummary,
    RecommendationProblemFamilyTension,
    RecommendationProblemFamilyTimelineItem,
    RecommendationQADigest,
    RecommendationRankingReason,
    RecommendationWindowComparisonSummary,
    RecommendationWindowDivergence,
    RecommendationWindowSummary,
    WeeklyAuthorityViolationCode,
    WeeklyObservabilitySummary,
} from "../core/models";
import { db } from "./sqlite";

type ObservabilitySummaryRow = {
  planId: string;
  classId: string;
  cycleId: string;
  weekNumber: number;
  summaryJson: string;
  capturedAt?: string;
  computedAt: string;
};

export type PlanObservabilityRecord = {
  planId: string;
  classId: string;
  cycleId: string;
  weekNumber: number;
  summary: WeeklyObservabilitySummary;
  capturedAt: string;
  computedAt: string;
};

export type ObservabilityTrendByClass = {
  totalWeeks: number;
  coherentWeeks: number;
  coherencePassRate: number;
  averageCoherenceScore: number;
  unstableWeeks: number;
  highSeverityWeeks: number;
  attentionWeeks: number;
  authorityViolationWeeks: number;
};

export type DriftFrequencyByClassItem = {
  code: PedagogicalDriftCode;
  total: number;
  low: number;
  medium: number;
  high: number;
};

export type UnstableObservabilityWeek = {
  planId: string;
  classId: string;
  cycleId: string;
  weekNumber: number;
  coherenceScore: number;
  driftSignals: WeeklyObservabilitySummary["driftSignals"];
  capturedAt: string;
  computedAt: string;
};

export type ObservabilityInsightCode =
  | "coherence_drop_recent"
  | "top_recurring_drift"
  | "quarter_instability_concentration"
  | "quarter_closing_consistency"
  | "authority_break_recurrence"
  | "stability_escalation_recent";

export type ObservabilityInsightScope =
  | "recent_window"
  | "current_quarter"
  | "class_history"
  | "authority";

export type ObservabilityInsight = {
  code: ObservabilityInsightCode;
  severity: "info" | "warning" | "critical";
  message: string;
  scope: ObservabilityInsightScope;
  evidence?: {
    weeksConsidered?: number;
    count?: number;
    ratio?: number;
    dominantCode?: string;
  };
};

const DRIFT_CODES: PedagogicalDriftCode[] = [
  "weekly_session_misalignment",
  "weekly_authority_violation",
  "quarter_week_misalignment",
  "load_flattening",
  "repetition_excess",
  "progression_stagnation",
];

const toSafeSummary = (raw: string): WeeklyObservabilitySummary | null => {
  try {
    return JSON.parse(raw || "{}") as WeeklyObservabilitySummary;
  } catch {
    return null;
  }
};

const toRecord = (row: ObservabilitySummaryRow): PlanObservabilityRecord | null => {
  const summary = toSafeSummary(row.summaryJson);
  if (!summary) return null;

  const nowIso = new Date().toISOString();
  const capturedAt = String(row.capturedAt ?? "").trim() || String(row.computedAt ?? "").trim() || nowIso;
  const computedAt = String(row.computedAt ?? "").trim() || capturedAt;

  return {
    planId: row.planId,
    classId: row.classId,
    cycleId: row.cycleId,
    weekNumber: row.weekNumber,
    summary,
    capturedAt,
    computedAt,
  };
};

const computeCoherenceScore = (summary: WeeklyObservabilitySummary) => {
  const total = summary.coherence.length;
  if (!total) return 1;
  const ok = summary.coherence.filter((item) => {
    const coherenceItem = item as { envelopeRespected?: boolean; ok?: boolean };
    return coherenceItem.envelopeRespected ?? coherenceItem.ok ?? false;
  }).length;
  return ok / total;
};

const getStabilityStatus = (summary: WeeklyObservabilitySummary) => {
  return summary.stability?.status ?? (isLegacyUnstable(summary) ? "unstable" : "stable");
};

const getStabilitySeverity = (summary: WeeklyObservabilitySummary) => {
  if (summary.stability?.severity) return summary.stability.severity;
  if (summary.driftSignals.some((signal) => signal.detected && signal.severity === "high")) {
    return "high";
  }
  if (summary.driftSignals.some((signal) => signal.detected && signal.severity === "medium")) {
    return "medium";
  }
  return "low";
};

const hasAuthorityViolations = (summary: WeeklyObservabilitySummary) => {
  return summary.authority?.hasViolations ?? false;
};

const isLegacyUnstable = (summary: WeeklyObservabilitySummary) => {
  const hasMediumOrHighDrift = summary.driftSignals.some(
    (signal) => signal.detected && (signal.severity === "medium" || signal.severity === "high")
  );
  return hasMediumOrHighDrift || computeCoherenceScore(summary) < 1;
};

const isUnstableWeek = (summary: WeeklyObservabilitySummary) => {
  return getStabilityStatus(summary) === "unstable";
};

const formatDriftCodeLabel = (code: PedagogicalDriftCode) => code.replace(/_/g, " ");

const getStabilityRank = (status: "stable" | "attention" | "unstable") => {
  switch (status) {
    case "unstable":
      return 3;
    case "attention":
      return 2;
    case "stable":
    default:
      return 1;
  }
};

const sortInsights = (insights: ObservabilityInsight[]): ObservabilityInsight[] => {
  const severityRank: Record<ObservabilityInsight["severity"], number> = {
    critical: 3,
    warning: 2,
    info: 1,
  };
  const semanticRank: Record<ObservabilityInsightCode, number> = {
    authority_break_recurrence: 1,
    stability_escalation_recent: 2,
    quarter_instability_concentration: 3,
    coherence_drop_recent: 4,
    top_recurring_drift: 5,
    quarter_closing_consistency: 6,
  };

  return [...insights].sort((a, b) => {
    const bySeverity = severityRank[b.severity] - severityRank[a.severity];
    if (bySeverity !== 0) return bySeverity;
    return semanticRank[a.code] - semanticRank[b.code];
  });
};

const sortRecommendations = (recommendations: ObservabilityRecommendation[]) => {
  const priorityRank: Record<ObservabilityRecommendation["priority"], number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  return [...recommendations].sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);
};

const dedupeRecommendations = (recommendations: ObservabilityRecommendation[]) => {
  const seen = new Set<string>();
  const result: ObservabilityRecommendation[] = [];

  for (const item of recommendations) {
    if (seen.has(item.code)) continue;
    seen.add(item.code);
    result.push(item);
  }

  return result;
};

const getRecentAuthorityViolations = (
  records: PlanObservabilityRecord[],
  windowSize = 4
): WeeklyAuthorityViolationCode[] => {
  const recent = [...records]
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .slice(-Math.min(windowSize, records.length));

  return recent.flatMap((record) =>
    record.summary.authority.checks.flatMap((check) => check.violations)
  );
};

// ---------------------------------------------------------------------------
// Pure synchronous aggregators — work from already-loaded records in memory,
// avoiding extra DB round-trips when history is already in state.
// ---------------------------------------------------------------------------

export function computeObservabilityTrendFromRecords(
  records: PlanObservabilityRecord[]
): ObservabilityTrendByClass {
  if (!records.length) {
    return {
      totalWeeks: 0,
      coherentWeeks: 0,
      coherencePassRate: 0,
      averageCoherenceScore: 0,
      unstableWeeks: 0,
      highSeverityWeeks: 0,
      attentionWeeks: 0,
      authorityViolationWeeks: 0,
    };
  }
  const coherentWeeks = records.filter((r) =>
    r.summary.coherence.every((item) => {
      const coherenceItem = item as { envelopeRespected?: boolean; ok?: boolean };
      return coherenceItem.envelopeRespected ?? coherenceItem.ok ?? false;
    })
  ).length;
  const coherenceScores = records.map((r) => computeCoherenceScore(r.summary));
  const unstableWeeks = records.filter((r) => isUnstableWeek(r.summary)).length;
  const highSeverityWeeks = records.filter((r) => getStabilitySeverity(r.summary) === "high").length;
  const attentionWeeks = records.filter((r) => getStabilityStatus(r.summary) === "attention").length;
  const authorityViolationWeeks = records.filter((r) => hasAuthorityViolations(r.summary)).length;
  return {
    totalWeeks: records.length,
    coherentWeeks,
    coherencePassRate: coherentWeeks / records.length,
    averageCoherenceScore:
      coherenceScores.reduce((total, v) => total + v, 0) / Math.max(1, coherenceScores.length),
    unstableWeeks,
    highSeverityWeeks,
    attentionWeeks,
    authorityViolationWeeks,
  };
}

export function computeDriftFrequencyFromRecords(
  records: PlanObservabilityRecord[]
): DriftFrequencyByClassItem[] {
  const counters: Record<PedagogicalDriftCode, { total: number; low: number; medium: number; high: number }> = {
    weekly_session_misalignment: { total: 0, low: 0, medium: 0, high: 0 },
    weekly_authority_violation: { total: 0, low: 0, medium: 0, high: 0 },
    quarter_week_misalignment: { total: 0, low: 0, medium: 0, high: 0 },
    load_flattening: { total: 0, low: 0, medium: 0, high: 0 },
    repetition_excess: { total: 0, low: 0, medium: 0, high: 0 },
    progression_stagnation: { total: 0, low: 0, medium: 0, high: 0 },
  };
  for (const record of records) {
    for (const signal of record.summary.driftSignals) {
      if (!signal.detected) continue;
      const counter = counters[signal.code];
      if (!counter) continue;
      counter.total += 1;
      counter[signal.severity] += 1;
    }
  }
  return DRIFT_CODES.map((code) => ({ code, ...counters[code] })).sort((a, b) => b.total - a.total);
}

export function computeRecentUnstableWeeksFromRecords(
  records: PlanObservabilityRecord[],
  limit = 6
): UnstableObservabilityWeek[] {
  return [...records]
    .sort((a, b) => b.computedAt.localeCompare(a.computedAt))
    .filter((r) => isUnstableWeek(r.summary))
    .slice(0, Math.max(1, Math.floor(limit)))
    .map((r) => ({
      planId: r.planId,
      classId: r.classId,
      cycleId: r.cycleId,
      weekNumber: r.weekNumber,
      coherenceScore: computeCoherenceScore(r.summary),
      driftSignals: r.summary.driftSignals.filter((signal) => signal.detected),
      capturedAt: r.capturedAt,
      computedAt: r.computedAt,
    }));
}

export function buildObservabilityInsightsFromRecords(
  records: PlanObservabilityRecord[]
): ObservabilityInsight[] {
  if (!records.length) return [];

  const insights: ObservabilityInsight[] = [];
  const byWeekAsc = [...records].sort((a, b) => a.weekNumber - b.weekNumber);
  const recentWindow = byWeekAsc.slice(-Math.min(4, byWeekAsc.length));
  const previousWindow = byWeekAsc.slice(
    Math.max(0, byWeekAsc.length - recentWindow.length * 2),
    Math.max(0, byWeekAsc.length - recentWindow.length)
  );

  if (recentWindow.length >= 2 && previousWindow.length >= 2) {
    const recentAvg =
      recentWindow.reduce((total, record) => total + computeCoherenceScore(record.summary), 0) /
      recentWindow.length;
    const previousAvg =
      previousWindow.reduce((total, record) => total + computeCoherenceScore(record.summary), 0) /
      previousWindow.length;

    if (recentAvg + 0.1 < previousAvg) {
      insights.push({
        code: "coherence_drop_recent",
        severity: recentAvg < 0.75 ? "critical" : "warning",
        scope: "recent_window",
        message: "A turma apresentou queda de coerencia nas ultimas semanas.",
        evidence: {
          weeksConsidered: recentWindow.length,
          ratio: Number(recentAvg.toFixed(2)),
        },
      });
    }
  }

  const recentAuthorityBreaks = recentWindow.filter((record) =>
    hasAuthorityViolations(record.summary)
  ).length;
  if (recentAuthorityBreaks >= 2) {
    insights.push({
      code: "authority_break_recurrence",
      severity: recentAuthorityBreaks >= 3 ? "critical" : "warning",
      scope: "authority",
      message: "A autoridade semanal esta sendo quebrada repetidamente nas ultimas semanas.",
      evidence: {
        count: recentAuthorityBreaks,
        weeksConsidered: recentWindow.length,
      },
    });
  }

  if (recentWindow.length >= 3) {
    const ranks = recentWindow.map((record) => getStabilityRank(getStabilityStatus(record.summary)));
    const isEscalating = ranks[ranks.length - 1] > ranks[0];
    if (isEscalating) {
      insights.push({
        code: "stability_escalation_recent",
        severity: ranks[ranks.length - 1] === 3 ? "critical" : "warning",
        scope: "recent_window",
        message: "A estabilidade da turma piorou nas ultimas semanas.",
        evidence: {
          weeksConsidered: recentWindow.length,
        },
      });
    }
  }

  const driftFrequency = computeDriftFrequencyFromRecords(byWeekAsc).find((item) => item.total > 0);
  if (driftFrequency) {
    const severeCount = driftFrequency.medium + driftFrequency.high;
    insights.push({
      code: "top_recurring_drift",
      severity: severeCount >= 2 ? "warning" : "info",
      scope: "class_history",
      message: `O drift mais recorrente e ${formatDriftCodeLabel(driftFrequency.code)} (${driftFrequency.total} ocorrencias).`,
      evidence: {
        count: driftFrequency.total,
        dominantCode: driftFrequency.code,
      },
    });
  }

  const latest = byWeekAsc[byWeekAsc.length - 1];
  const latestQuarter = latest.summary.quarter;
  const quarterRecords = byWeekAsc.filter((record) => record.summary.quarter === latestQuarter);
  if (quarterRecords.length >= 2) {
    const unstableCount = quarterRecords.filter((record) => isUnstableWeek(record.summary)).length;
    const unstableRatio = unstableCount / quarterRecords.length;
    if (unstableRatio >= 0.5) {
      insights.push({
        code: "quarter_instability_concentration",
        severity: unstableRatio >= 0.75 ? "critical" : "warning",
        scope: "current_quarter",
        message: `Ha concentracao de semanas instaveis no trimestre atual (${latestQuarter}).`,
        evidence: {
          count: unstableCount,
          ratio: Number(unstableRatio.toFixed(2)),
          weeksConsidered: quarterRecords.length,
        },
      });
    }

    const expectedClosingType = latest.summary.closingType;
    const closingConsistent = quarterRecords.every(
      (record) => record.summary.closingType === expectedClosingType
    );
    insights.push({
      code: "quarter_closing_consistency",
      severity: closingConsistent ? "info" : "warning",
      scope: "current_quarter",
      message: closingConsistent
        ? `O fechamento do trimestre atual esta consistente (${expectedClosingType}).`
        : `O fechamento do trimestre atual esta inconsistente (${latestQuarter}).`,
      evidence: {
        weeksConsidered: quarterRecords.length,
      },
    });
  }

  return sortInsights(insights);
}

export function buildObservabilityRecommendationsFromRecords(
  records: PlanObservabilityRecord[]
): ObservabilityRecommendation[] {
  if (!records.length) return [];

  const recommendations: ObservabilityRecommendation[] = [];
  const insights = buildObservabilityInsightsFromRecords(records);
  const insightCodes = new Set(insights.map((item) => item.code));
  const topDrift = computeDriftFrequencyFromRecords(records).find((item) => item.total > 0);
  const recentAuthorityViolations = getRecentAuthorityViolations(records, 4);
  const authorityViolationSet = new Set(recentAuthorityViolations);

  if (
    insightCodes.has("authority_break_recurrence") ||
    topDrift?.code === "weekly_authority_violation"
  ) {
    recommendations.push({
      code: "restore_weekly_role_alignment",
      priority: "high",
      action: "review_current_week",
      title: "Restaurar alinhamento entre semana e sessao",
      message: "Uma ou mais sessoes estao escapando repetidamente do papel semanal esperado.",
      rationale: "A autoridade semanal foi quebrada em multiplas semanas recentes.",
      sourceSignals: ["authority_break_recurrence", "weekly_authority_violation"],
    });
  }

  if (authorityViolationSet.has("pure_technical_isolation_not_allowed")) {
    recommendations.push({
      code: "reduce_technical_isolation",
      priority: "high",
      action: "review_current_week",
      title: "Reduzir isolamento tecnico puro",
      message: "A sessao esta tecnica demais para o papel semanal esperado.",
      rationale:
        "Foi detectada violacao de autoridade com isolamento tecnico incompativel com transferencia ou fechamento.",
      sourceSignals: ["pure_technical_isolation_not_allowed"],
    });
  }

  if (
    authorityViolationSet.has("missing_closure_signal") ||
    insights.some((item) => item.code === "quarter_closing_consistency" && item.severity === "warning")
  ) {
    recommendations.push({
      code: "reinforce_quarter_closing_signal",
      priority: "high",
      action: "adjust_next_week",
      title: "Reforcar sinal de fechamento do trimestre",
      message: "O fechamento do trimestre nao esta ficando perceptivel na execucao das sessoes.",
      rationale: "A estabilidade recente mostra perda de fechamento coerente com o momento do ciclo.",
      sourceSignals: ["missing_closure_signal", "quarter_closing_consistency"],
    });
  }

  if (topDrift?.code === "repetition_excess") {
    recommendations.push({
      code: "reduce_repetition_with_controlled_variation",
      priority: "medium",
      action: "adjust_next_week",
      title: "Reduzir repeticao com variacao controlada",
      message: "A turma esta repetindo padroes demais sem ganho claro de progressao.",
      rationale: "O drift mais recorrente atual esta ligado ao excesso de repeticao.",
      sourceSignals: ["top_recurring_drift", "repetition_excess"],
    });
  }

  if (topDrift?.code === "load_flattening") {
    recommendations.push({
      code: "rebalance_load_progression",
      priority: "medium",
      action: "adjust_next_week",
      title: "Reequilibrar progressao de carga",
      message: "A semana esta com contraste de carga baixo ou achatado.",
      rationale: "Foi detectado achatamento de carga com impacto na estabilidade observacional.",
      sourceSignals: ["load_flattening"],
    });
  }

  if (authorityViolationSet.has("game_transfer_below_weekly_role_minimum")) {
    recommendations.push({
      code: "increase_game_transfer",
      priority: "medium",
      action: "adjust_next_week",
      title: "Aumentar transferencia para jogo",
      message:
        "As sessoes estao abaixo do nivel minimo de transferencia esperado para o papel semanal.",
      rationale:
        "O envelope semanal exige mais leitura de jogo e tomada de decisao do que esta aparecendo na pratica.",
      sourceSignals: ["game_transfer_below_weekly_role_minimum"],
    });
  }

  if (insightCodes.has("stability_escalation_recent")) {
    recommendations.push({
      code: "review_recent_week_design",
      priority: "high",
      action: "review_current_week",
      title: "Revisar o desenho recente das semanas",
      message: "A estabilidade da turma vem piorando nas ultimas semanas.",
      rationale: "Houve escalada recente de atencao/instabilidade na observabilidade historica.",
      sourceSignals: ["stability_escalation_recent"],
    });
  }

  return sortRecommendations(dedupeRecommendations(recommendations)).slice(0, 5);
}

function classifyRecommendationEvidence(params: {
  baseline: PlanObservabilityRecord;
  following: PlanObservabilityRecord[];
}): {
  outcome: RecommendationEvidenceOutcome;
  rationale: string;
  delta: RecommendationEvidence["delta"];
} {
  const baseline = params.baseline;
  const following = params.following;

  const baselineCoherence = computeCoherenceScore(baseline.summary);
  const baselineStabilityRank = getStabilityRank(getStabilityStatus(baseline.summary));
  const baselineUnstable = isUnstableWeek(baseline.summary) ? 1 : 0;
  const baselineAuthorityViolations = hasAuthorityViolations(baseline.summary) ? 1 : 0;

  const avgFollowingCoherence =
    following.reduce((sum, item) => sum + computeCoherenceScore(item.summary), 0) /
    Math.max(1, following.length);
  const avgFollowingStabilityRank =
    following.reduce((sum, item) => sum + getStabilityRank(getStabilityStatus(item.summary)), 0) /
    Math.max(1, following.length);
  const followingUnstable = following.filter((item) => isUnstableWeek(item.summary)).length;
  const followingAuthorityViolations = following.filter((item) =>
    hasAuthorityViolations(item.summary)
  ).length;

  const coherenceDelta = Number((avgFollowingCoherence - baselineCoherence).toFixed(2));
  const unstableDelta = followingUnstable - baselineUnstable;
  const authorityDelta = followingAuthorityViolations - baselineAuthorityViolations;

  const stabilityImproved = avgFollowingStabilityRank + 0.5 < baselineStabilityRank;
  const stabilityWorsened = avgFollowingStabilityRank - 0.5 > baselineStabilityRank;
  const authorityRecovered = baselineAuthorityViolations > 0 && followingAuthorityViolations === 0;
  const authorityWorsened = followingAuthorityViolations > baselineAuthorityViolations;

  if (stabilityImproved || coherenceDelta >= 0.1 || authorityRecovered) {
    return {
      outcome: "improved",
      rationale: "As semanas seguintes mostraram melhora observacional apos a decisao.",
      delta: {
        coherenceScore: coherenceDelta,
        unstableWeeks: unstableDelta,
        authorityViolationWeeks: authorityDelta,
      },
    };
  }

  if (stabilityWorsened || coherenceDelta <= -0.1 || authorityWorsened) {
    return {
      outcome: "worsened",
      rationale: "As semanas seguintes mostraram piora observacional apos a decisao.",
      delta: {
        coherenceScore: coherenceDelta,
        unstableWeeks: unstableDelta,
        authorityViolationWeeks: authorityDelta,
      },
    };
  }

  return {
    outcome: "unchanged",
    rationale: "A observabilidade seguiu praticamente estavel nas semanas seguintes.",
    delta: {
      coherenceScore: coherenceDelta,
      unstableWeeks: unstableDelta,
      authorityViolationWeeks: authorityDelta,
    },
  };
}

export function buildRecommendationEvidenceFromRecords(params: {
  decisions: ObservabilityRecommendationDecision[];
  records: PlanObservabilityRecord[];
  lookaheadWeeks?: number;
}): RecommendationEvidence[] {
  const { decisions, records, lookaheadWeeks = 2 } = params;
  if (!decisions.length || !records.length) return [];

  const safeLookahead = Math.max(1, Math.floor(lookaheadWeeks));
  const recordsAsc = [...records].sort((a, b) => a.weekNumber - b.weekNumber);

  return decisions
    .map((decision) => {
      const baseline =
        recordsAsc.find(
          (record) =>
            record.planId === decision.planId ||
            (record.classId === decision.classId && record.weekNumber === decision.weekNumber)
        ) ?? null;

      if (!baseline) {
        return {
          recommendationCode: decision.recommendationCode,
          decisionStatus: decision.status,
          baselineWeekNumber: decision.weekNumber,
          comparedWeeks: [],
          outcome: "insufficient_evidence" as const,
          rationale: "Nao ha baseline observacional correspondente para avaliar a decisao.",
        };
      }

      const following = recordsAsc
        .filter((record) =>
          record.classId === baseline.classId &&
          record.weekNumber > baseline.weekNumber &&
          record.weekNumber <= baseline.weekNumber + safeLookahead
        )
        .slice(0, safeLookahead);

      if (following.length < safeLookahead) {
        return {
          recommendationCode: decision.recommendationCode,
          decisionStatus: decision.status,
          baselineWeekNumber: baseline.weekNumber,
          comparedWeeks: following.map((item) => item.weekNumber),
          outcome: "insufficient_evidence" as const,
          rationale: "Ainda nao ha semanas futuras suficientes para avaliar esta recomendacao.",
        };
      }

      const classified = classifyRecommendationEvidence({
        baseline,
        following,
      });

      return {
        recommendationCode: decision.recommendationCode,
        decisionStatus: decision.status,
        baselineWeekNumber: baseline.weekNumber,
        comparedWeeks: following.map((item) => item.weekNumber),
        outcome: classified.outcome,
        rationale: classified.rationale,
        delta: classified.delta,
      };
    })
    .sort((a, b) => b.baselineWeekNumber - a.baselineWeekNumber);
}

function resolveRecommendationConfidence(params: {
  improvedCount: number;
  unchangedCount: number;
  worsenedCount: number;
  insufficientEvidenceCount: number;
}): RecommendationObservationalConfidence {
  const observed = params.improvedCount + params.unchangedCount + params.worsenedCount;
  if (observed < 2) return "low";
  if (params.insufficientEvidenceCount > observed) return "low";

  const dominant = Math.max(params.improvedCount, params.unchangedCount, params.worsenedCount);
  const dominanceRatio = dominant / Math.max(1, observed);

  if (observed >= 3 && dominanceRatio >= 0.6) return "high";
  return "medium";
}

export function buildRecommendationFamilyAggregates(params: {
  decisions: ObservabilityRecommendationDecision[];
  evidence: RecommendationEvidence[];
}): RecommendationFamilyAggregate[] {
  const { decisions, evidence } = params;
  if (!decisions.length) return [];

  const codes = new Set(decisions.map((item) => item.recommendationCode));

  return [...codes]
    .map((code) => {
      const decisionsByCode = decisions.filter((item) => item.recommendationCode === code);
      const evidenceByCode = evidence.filter((item) => item.recommendationCode === code);

      const improvedCount = evidenceByCode.filter((item) => item.outcome === "improved").length;
      const unchangedCount = evidenceByCode.filter((item) => item.outcome === "unchanged").length;
      const worsenedCount = evidenceByCode.filter((item) => item.outcome === "worsened").length;
      const insufficientEvidenceCount = evidenceByCode.filter(
        (item) => item.outcome === "insufficient_evidence"
      ).length;

      const aggregate: RecommendationFamilyAggregate = {
        recommendationCode: code,
        totalSuggested: decisionsByCode.length,
        totalAccepted: decisionsByCode.filter((item) => item.status === "accepted").length,
        totalRejected: decisionsByCode.filter((item) => item.status === "rejected").length,
        improvedCount,
        unchangedCount,
        worsenedCount,
        insufficientEvidenceCount,
        confidence: resolveRecommendationConfidence({
          improvedCount,
          unchangedCount,
          worsenedCount,
          insufficientEvidenceCount,
        }),
      };

      return aggregate;
    })
    .sort((a, b) => {
      const bySuggested = b.totalSuggested - a.totalSuggested;
      if (bySuggested !== 0) return bySuggested;
      return a.recommendationCode.localeCompare(b.recommendationCode);
    });
}

function getPriorityScore(priority: ObservabilityRecommendation["priority"]): number {
  switch (priority) {
    case "high":
      return 30;
    case "medium":
      return 20;
    case "low":
    default:
      return 10;
  }
}

function getConfidenceBonus(confidence: RecommendationObservationalConfidence): number {
  switch (confidence) {
    case "high":
      return 5;
    case "medium":
      return 2;
    case "low":
    default:
      return 0;
  }
}

function resolveConfidenceFraming(params: {
  confidence: RecommendationObservationalConfidence;
  improvedCount: number;
  worsenedCount: number;
}): RecommendationConfidenceFraming {
  if (params.confidence !== "high") return "history_inconclusive";
  if (params.improvedCount > params.worsenedCount) return "history_favorable";
  if (params.worsenedCount > params.improvedCount) return "history_unfavorable";
  return "history_inconclusive";
}

function getFramingMessage(framing: RecommendationConfidenceFraming): string {
  switch (framing) {
    case "history_favorable":
      return "Historico observacional favoravel nesta turma.";
    case "history_unfavorable":
      return "Historico observacional desfavoravel: esta recommendation ainda nao mostrou melhora consistente nesta turma.";
    case "history_inconclusive":
    default:
      return "Historico ainda inconclusivo para esta recommendation nesta turma.";
  }
}

function buildRecommendationPresentation(params: {
  framing: RecommendationConfidenceFraming;
}): RecommendationPresentation {
  switch (params.framing) {
    case "history_favorable":
      return {
        tone: "reinforced",
        shortLabel: "Historico favoravel",
        helperText: "Esta recommendation ja mostrou resposta positiva nesta turma.",
      };
    case "history_unfavorable":
      return {
        tone: "cautious",
        shortLabel: "Historico desfavoravel",
        helperText:
          "Aplicar com cautela: ainda nao houve melhora consistente nesta turma.",
      };
    case "history_inconclusive":
    default:
      return {
        tone: "neutral",
        shortLabel: "Historico inconclusivo",
        helperText:
          "Ainda nao ha evidencia suficiente para afirmar efeito consistente nesta turma.",
      };
  }
}

function getRecommendationProblemFamily(
  code: ObservabilityRecommendation["code"]
): RecommendationProblemFamily {
  switch (code) {
    case "restore_weekly_role_alignment":
      return "weekly_alignment";
    case "reduce_technical_isolation":
      return "technical_isolation";
    case "rebalance_load_progression":
      return "load_progression";
    case "increase_game_transfer":
      return "game_transfer";
    case "reinforce_quarter_closing_signal":
      return "quarter_closing";
    case "reduce_repetition_with_controlled_variation":
      return "repetition_control";
    case "review_recent_week_design":
    default:
      return "recent_week_design";
  }
}

function buildRecommendationFamilyPresentation(
  family: RecommendationProblemFamily
): RecommendationFamilyPresentation {
  switch (family) {
    case "weekly_alignment":
      return {
        family,
        familyLabel: "Alinhamento semanal",
        familyHelperText: "Problemas entre papel da semana e execucao das sessoes.",
      };
    case "technical_isolation":
      return {
        family,
        familyLabel: "Isolamento tecnico",
        familyHelperText: "A sessao esta tecnica demais para o momento pedagogico esperado.",
      };
    case "load_progression":
      return {
        family,
        familyLabel: "Progressao de carga",
        familyHelperText: "Ha sinais de carga achatada ou contraste insuficiente.",
      };
    case "game_transfer":
      return {
        family,
        familyLabel: "Transferencia para jogo",
        familyHelperText: "A sessao pede mais leitura, decisao e aproximacao ao jogo.",
      };
    case "quarter_closing":
      return {
        family,
        familyLabel: "Fechamento trimestral",
        familyHelperText: "O momento do trimestre ainda nao esta perceptivel na pratica.",
      };
    case "repetition_control":
      return {
        family,
        familyLabel: "Controle de repeticao",
        familyHelperText: "Ha repeticao excessiva sem variacao controlada suficiente.",
      };
    case "recent_week_design":
    default:
      return {
        family: "recent_week_design",
        familyLabel: "Desenho recente das semanas",
        familyHelperText: "As semanas recentes sugerem revisao do encadeamento pedagogico.",
      };
  }
}

export function buildConfidenceInformedRecommendations(params: {
  recommendations: ObservabilityRecommendation[];
  aggregates: RecommendationFamilyAggregate[];
}): ConfidenceInformedRecommendation[] {
  const aggregateByCode = new Map(
    params.aggregates.map((item) => [item.recommendationCode, item])
  );

  return [...params.recommendations].map((recommendation) => {
    const aggregate = aggregateByCode.get(recommendation.code);
    const confidence = aggregate?.confidence ?? "low";
    const family = getRecommendationProblemFamily(recommendation.code);
    const framing = resolveConfidenceFraming({
      confidence,
      improvedCount: aggregate?.improvedCount ?? 0,
      worsenedCount: aggregate?.worsenedCount ?? 0,
    });

    return {
      recommendation,
      confidence,
      framing,
      framingMessage: getFramingMessage(framing),
      presentation: buildRecommendationPresentation({ framing }),
      familyPresentation: buildRecommendationFamilyPresentation(family),
    };
  });
}

export function buildRankedRecommendations(params: {
  recommendations: ObservabilityRecommendation[];
  aggregates: RecommendationFamilyAggregate[];
}): RankedObservabilityRecommendation[] {
  const informed = buildConfidenceInformedRecommendations(params);

  return informed
    .map((item) => {
      const priorityScore = getPriorityScore(item.recommendation.priority);
      const rankingScore = priorityScore + getConfidenceBonus(item.confidence);

      let rankingReason: RecommendationRankingReason = "base_priority_only";
      if (item.confidence === "high") rankingReason = "boosted_by_high_confidence";
      else if (item.confidence === "medium") rankingReason = "stable_medium_confidence";
      else if (item.recommendation.priority === "high") rankingReason = "held_by_low_confidence";

      return {
        recommendation: item.recommendation,
        confidence: item.confidence,
        framing: item.framing,
        framingMessage: item.framingMessage,
        presentation: item.presentation,
        familyPresentation: item.familyPresentation,
        rankingScore,
        rankingReason,
      };
    })
    .sort((a, b) => {
      const byScore = b.rankingScore - a.rankingScore;
      if (byScore !== 0) return byScore;
      const byPriority = getPriorityScore(b.recommendation.priority) - getPriorityScore(a.recommendation.priority);
      if (byPriority !== 0) return byPriority;
      return a.recommendation.code.localeCompare(b.recommendation.code);
    });
}

export function buildRecommendationProblemFamilySummary(params: {
  rankedRecommendations: RankedObservabilityRecommendation[];
}): RecommendationProblemFamilySummary {
  const { rankedRecommendations } = params;
  if (!rankedRecommendations.length) {
    return {
      dominantFamily: null,
      dominantFamilyLabel: null,
      cohorts: [],
    };
  }

  const byFamily = new Map<string, RecommendationProblemFamilyCohort>();

  for (const item of rankedRecommendations) {
    const key = item.familyPresentation.family;
    const current = byFamily.get(key);
    if (!current) {
      byFamily.set(key, {
        family: item.familyPresentation.family,
        familyLabel: item.familyPresentation.familyLabel,
        familyHelperText: item.familyPresentation.familyHelperText,
        recommendationsCount: 1,
        highPriorityCount: item.recommendation.priority === "high" ? 1 : 0,
        cautiousCount: item.presentation.tone === "cautious" ? 1 : 0,
      });
      continue;
    }

    current.recommendationsCount += 1;
    if (item.recommendation.priority === "high") current.highPriorityCount += 1;
    if (item.presentation.tone === "cautious") current.cautiousCount += 1;
  }

  const cohorts = [...byFamily.values()].sort((a, b) => {
    const byCount = b.recommendationsCount - a.recommendationsCount;
    if (byCount !== 0) return byCount;
    const byHighPriority = b.highPriorityCount - a.highPriorityCount;
    if (byHighPriority !== 0) return byHighPriority;
    return a.familyLabel.localeCompare(b.familyLabel);
  });

  const dominant = cohorts[0] ?? null;
  return {
    dominantFamily: dominant?.family ?? null,
    dominantFamilyLabel: dominant?.familyLabel ?? null,
    cohorts,
  };
}

function resolveFamilyTension(
  dominant: RecommendationProblemFamily,
  secondary: RecommendationProblemFamily | null
): RecommendationProblemFamilyTension {
  if (!secondary) return "isolated";

  const pair = [dominant, secondary].sort().join(":");
  const reinforcingPairs = new Set<string>([
    "quarter_closing:weekly_alignment",
    "game_transfer:technical_isolation",
    "recent_week_design:repetition_control",
  ]);
  const competingPairs = new Set<string>([
    "load_progression:quarter_closing",
    "load_progression:weekly_alignment",
    "game_transfer:repetition_control",
  ]);

  if (reinforcingPairs.has(pair)) return "reinforcing";
  if (competingPairs.has(pair)) return "competing";
  return "isolated";
}

function buildAxisSummaryText(params: {
  dominantLabel: string;
  secondaryLabel: string | null;
  tension: RecommendationProblemFamilyTension;
}): string {
  const { dominantLabel, secondaryLabel, tension } = params;

  if (!secondaryLabel || tension === "isolated") {
    return `O eixo dominante atual da turma e ${dominantLabel}, sem concorrencia forte de outro eixo.`;
  }
  if (tension === "reinforcing") {
    return `O eixo dominante atual e ${dominantLabel}, reforcado por ${secondaryLabel}.`;
  }
  return `O eixo dominante atual e ${dominantLabel}, mas ha tensao observacional com ${secondaryLabel}.`;
}

export function buildRecommendationProblemAxisSummary(params: {
  familySummary: RecommendationProblemFamilySummary | null;
}): RecommendationProblemAxisSummary | null {
  const familySummary = params.familySummary;
  if (!familySummary?.dominantFamily || !familySummary.dominantFamilyLabel) return null;

  const dominant = familySummary.cohorts[0] ?? null;
  if (!dominant) return null;

  const secondaryCandidate = familySummary.cohorts[1] ?? null;
  const hasRelevantSecondary =
    Boolean(secondaryCandidate) &&
    ((secondaryCandidate?.recommendationsCount ?? 0) >= 1 ||
      (secondaryCandidate?.highPriorityCount ?? 0) > 0);
  const secondary = hasRelevantSecondary ? secondaryCandidate : null;

  const tension = resolveFamilyTension(dominant.family, secondary?.family ?? null);
  const summary = buildAxisSummaryText({
    dominantLabel: dominant.familyLabel,
    secondaryLabel: secondary?.familyLabel ?? null,
    tension,
  });

  return {
    dominantFamily: dominant.family,
    dominantLabel: dominant.familyLabel,
    secondaryFamily: secondary?.family ?? null,
    secondaryLabel: secondary?.familyLabel ?? null,
    tension,
    summary,
  };
}

export function buildRecommendationProblemFamilyTimeline(params: {
  records: PlanObservabilityRecord[];
}): RecommendationProblemFamilyTimelineItem[] {
  const records = params.records;
  if (!records.length) return [];

  const latestByWeek = new Map<number, PlanObservabilityRecord>();
  const sorted = [...records].sort((a, b) => {
    const byWeek = a.weekNumber - b.weekNumber;
    if (byWeek !== 0) return byWeek;
    return a.computedAt.localeCompare(b.computedAt);
  });

  for (const item of sorted) {
    latestByWeek.set(item.weekNumber, item);
  }

  const normalized = [...latestByWeek.values()].sort((a, b) => a.weekNumber - b.weekNumber);

  return normalized
    .map((record, index) => {
      const historyUntilWeek = normalized.slice(0, index + 1);
      const recommendations = buildObservabilityRecommendationsFromRecords(historyUntilWeek);
      const ranked = buildRankedRecommendations({
        recommendations,
        aggregates: [],
      });
      const familySummary = buildRecommendationProblemFamilySummary({
        rankedRecommendations: ranked,
      });

      if (!familySummary.dominantFamily || !familySummary.dominantFamilyLabel) return null;

      return {
        weekNumber: record.weekNumber,
        dominantFamily: familySummary.dominantFamily,
        dominantLabel: familySummary.dominantFamilyLabel,
      };
    })
    .filter((item): item is RecommendationProblemFamilyTimelineItem => Boolean(item));
}

function getTransitionSummaryText(params: {
  transitionType: RecommendationAxisTransitionType;
  currentLabel: string;
  previousLabel: string | null;
}): string {
  const { transitionType, currentLabel, previousLabel } = params;

  if (transitionType === "axis_rotation") {
    return "A turma vem oscilando entre multiplos eixos de problema nas semanas recentes.";
  }
  if (transitionType === "axis_shift" && previousLabel) {
    return `O eixo dominante mudou recentemente de ${previousLabel} para ${currentLabel}.`;
  }
  return `O eixo dominante permaneceu em ${currentLabel} nas semanas recentes.`;
}

export function buildRecommendationAxisTransitionSummary(params: {
  timeline: RecommendationProblemFamilyTimelineItem[];
  windowSize?: number;
}): RecommendationAxisTransitionSummary | null {
  const timeline = params.timeline;
  if (timeline.length < 2) return null;

  const safeWindow = Math.max(2, Math.floor(params.windowSize ?? 4));
  const recent = timeline.slice(-Math.min(safeWindow, timeline.length));
  if (recent.length < 2) return null;

  const current = recent[recent.length - 1];
  const previous = recent[recent.length - 2];
  const distinctFamilies = [...new Set(recent.map((item) => item.dominantFamily))];

  let transitionType: RecommendationAxisTransitionType = "stable_axis";
  if (distinctFamilies.length >= 3) transitionType = "axis_rotation";
  else if (distinctFamilies.length === 1) transitionType = "stable_axis";
  else if (current.dominantFamily !== previous.dominantFamily) transitionType = "axis_shift";
  else transitionType = "stable_axis";

  return {
    transitionType,
    currentFamily: current.dominantFamily,
    currentLabel: current.dominantLabel,
    previousFamily: previous.dominantFamily,
    previousLabel: previous.dominantLabel,
    summary: getTransitionSummaryText({
      transitionType,
      currentLabel: current.dominantLabel,
      previousLabel: previous.dominantLabel,
    }),
  };
}

// ---------------------------------------------------------------------------
// Slice 3.6 — Persistence + Early Warning
// ---------------------------------------------------------------------------

function getPersistenceSummaryText(params: {
  persistenceType: RecommendationAxisPersistenceType;
  dominantLabel: string | null;
  weeksAnalyzed: number;
}): string {
  const { persistenceType, dominantLabel, weeksAnalyzed } = params;
  const label = dominantLabel ?? "desconhecido";
  if (persistenceType === "stable_persistence") {
    return `O eixo ${label} manteve dominancia consistente nas ultimas ${weeksAnalyzed} semanas.`;
  }
  if (persistenceType === "unstable_rotation") {
    return `A turma apresenta rotacao instavel de eixos nas ultimas ${weeksAnalyzed} semanas.`;
  }
  return `O eixo ${label} e predominante, mas com oscilacoes observadas.`;
}

export function buildRecommendationAxisPersistenceSummary(params: {
  timeline: RecommendationProblemFamilyTimelineItem[];
}): RecommendationAxisPersistenceSummary | null {
  const { timeline } = params;
  if (timeline.length < 2) return null;

  const weeksAnalyzed = timeline.length;

  // Count frequency per family
  const frequencyMap = new Map<RecommendationProblemFamily, number>();
  for (const item of timeline) {
    frequencyMap.set(item.dominantFamily, (frequencyMap.get(item.dominantFamily) ?? 0) + 1);
  }

  // Find dominant family (most frequent)
  let dominantFamily: RecommendationProblemFamily | null = null;
  let dominantLabel: string | null = null;
  let dominantCount = 0;
  for (const item of timeline) {
    const count = frequencyMap.get(item.dominantFamily) ?? 0;
    if (count > dominantCount) {
      dominantCount = count;
      dominantFamily = item.dominantFamily;
      dominantLabel = item.dominantLabel;
    }
  }

  const dominantRatio = dominantCount / weeksAnalyzed;
  const distinctFamilies = frequencyMap.size;

  let persistenceType: RecommendationAxisPersistenceType;
  if (dominantRatio >= 0.7) {
    persistenceType = "stable_persistence";
  } else if (distinctFamilies >= 3 && dominantRatio < 0.5) {
    persistenceType = "unstable_rotation";
  } else {
    persistenceType = "mixed_persistence";
  }

  let earlyWarning: RecommendationAxisEarlyWarning;
  if (persistenceType === "unstable_rotation" && weeksAnalyzed >= 4) {
    earlyWarning = "warning";
  } else if (persistenceType === "unstable_rotation" || persistenceType === "mixed_persistence") {
    earlyWarning = "attention";
  } else {
    earlyWarning = "none";
  }

  return {
    persistenceType,
    earlyWarning,
    dominantFamily,
    dominantLabel,
    weeksAnalyzed,
    summary: getPersistenceSummaryText({ persistenceType, dominantLabel, weeksAnalyzed }),
  };
}

// ---------------------------------------------------------------------------
// Slice 3.7 — QA Digest final por turma
// ---------------------------------------------------------------------------

export function buildRecommendationQADigest(params: {
  axisSummary: RecommendationProblemAxisSummary | null;
  persistenceSummary: RecommendationAxisPersistenceSummary | null;
  rankedRecommendations: RankedObservabilityRecommendation[];
}): RecommendationQADigest {
  const { axisSummary, persistenceSummary, rankedRecommendations } = params;

  const topRec = rankedRecommendations[0] ?? null;
  const recommendationFocus = topRec?.recommendation.title ?? null;

  const dominantAxisLabel = axisSummary?.dominantLabel ?? null;
  const secondaryAxisLabel = axisSummary?.secondaryLabel ?? null;
  const tension = axisSummary?.tension ?? null;
  const persistenceType = persistenceSummary?.persistenceType ?? null;
  const earlyWarning: RecommendationAxisEarlyWarning = persistenceSummary?.earlyWarning ?? "none";

  const parts: string[] = [];
  if (dominantAxisLabel) parts.push(`eixo dominante: ${dominantAxisLabel}`);
  if (tension && secondaryAxisLabel) parts.push(`tensao: ${tension} com ${secondaryAxisLabel}`);
  if (persistenceType) parts.push(`persistencia: ${persistenceType}`);
  if (earlyWarning !== "none") parts.push(`alerta: ${earlyWarning}`);
  if (recommendationFocus) parts.push(`recommendation focus: ${recommendationFocus}`);

  const summary =
    parts.length > 0
      ? parts.map((p) => `- ${p}`).join("\n")
      : "Dados insuficientes para digest.";

  return {
    dominantAxisLabel,
    secondaryAxisLabel,
    tension,
    persistenceType,
    earlyWarning,
    recommendationFocus,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Slice 3.8 — Janela comparativa curta vs média
// ---------------------------------------------------------------------------

function buildWindowSummary(
  slice: RecommendationProblemFamilyTimelineItem[]
): RecommendationWindowSummary {
  const windowSize = slice.length;
  if (windowSize === 0) {
    return { windowSize: 0, dominantFamily: null, dominantLabel: null, distinctFamilies: 0, persistenceType: null };
  }

  const freq = new Map<RecommendationProblemFamily, number>();
  for (const item of slice) {
    freq.set(item.dominantFamily, (freq.get(item.dominantFamily) ?? 0) + 1);
  }

  let dominantFamily: RecommendationProblemFamily | null = null;
  let dominantLabel: string | null = null;
  let dominantCount = 0;
  for (const item of slice) {
    const count = freq.get(item.dominantFamily) ?? 0;
    if (count > dominantCount) {
      dominantCount = count;
      dominantFamily = item.dominantFamily;
      dominantLabel = item.dominantLabel;
    }
  }

  const distinctFamilies = freq.size;
  const ratio = dominantCount / windowSize;

  let persistenceType: RecommendationAxisPersistenceType | null;
  if (windowSize < 2) {
    persistenceType = null;
  } else if (ratio >= 0.7) {
    persistenceType = "stable_persistence";
  } else if (distinctFamilies >= 3 && ratio < 0.5) {
    persistenceType = "unstable_rotation";
  } else {
    persistenceType = "mixed_persistence";
  }

  return { windowSize, dominantFamily, dominantLabel, distinctFamilies, persistenceType };
}

export function buildRecommendationWindowComparisonSummary(params: {
  timeline: RecommendationProblemFamilyTimelineItem[];
  shortWindowSize?: number;
  mediumWindowSize?: number;
}): RecommendationWindowComparisonSummary | null {
  const { timeline } = params;
  const shortSize = Math.max(2, Math.floor(params.shortWindowSize ?? 3));
  const mediumSize = Math.max(shortSize + 1, Math.floor(params.mediumWindowSize ?? 7));

  if (timeline.length < 2) return null;

  const shortSlice = timeline.slice(-Math.min(shortSize, timeline.length));
  const mediumSlice = timeline.slice(-Math.min(mediumSize, timeline.length));

  const shortWindow = buildWindowSummary(shortSlice);
  const mediumWindow = buildWindowSummary(mediumSlice);

  let divergence: RecommendationWindowDivergence;
  if (!shortWindow.dominantFamily || !mediumWindow.dominantFamily) {
    divergence = "insufficient_data";
  } else if (shortWindow.dominantFamily === mediumWindow.dominantFamily) {
    divergence = "same_axis";
  } else {
    divergence = "different_axis";
  }

  let interpretation: RecommendationWindowComparisonSummary["interpretation"];
  if (divergence === "insufficient_data") {
    interpretation = "inconclusive";
  } else if (divergence === "different_axis") {
    interpretation = "acute";
  } else {
    // same_axis — check if medium window is stable
    interpretation = mediumWindow.persistenceType === "stable_persistence" ? "structural" : "inconclusive";
  }

  let summary: string;
  if (interpretation === "acute") {
    summary = `O problema recente (${shortWindow.dominantLabel}) diverge do eixo medio (${mediumWindow.dominantLabel}), sugerindo oscilacao aguda.`;
  } else if (interpretation === "structural") {
    summary = `O eixo ${mediumWindow.dominantLabel} e consistente tanto na janela curta quanto na media, sugerindo padrao estrutural.`;
  } else {
    summary = "Janelas curta e media nao permitem leitura conclusiva ainda.";
  }

  return { shortWindow, mediumWindow, divergence, interpretation, summary };
}

// ---------------------------------------------------------------------------
// Slice 3.9 — Convergência / Divergência eixo × recommendation focus
// ---------------------------------------------------------------------------

export function buildRecommendationAxisAlignmentSummary(params: {
  axisSummary: RecommendationProblemAxisSummary | null;
  rankedRecommendations: RankedObservabilityRecommendation[];
}): RecommendationAxisAlignmentSummary | null {
  const { axisSummary, rankedRecommendations } = params;
  if (!axisSummary) return null;

  const topRec = rankedRecommendations[0] ?? null;
  if (!topRec) return null;

  const axisFamily = axisSummary.dominantFamily;
  const axisLabel = axisSummary.dominantLabel;
  const recFamily = topRec.familyPresentation.family;
  const recLabel = topRec.familyPresentation.familyLabel;

  let alignmentType: RecommendationAxisAlignmentType;
  if (recFamily === axisFamily) {
    alignmentType = "convergent";
  } else if (axisSummary.secondaryFamily && recFamily === axisSummary.secondaryFamily) {
    alignmentType = "partially_convergent";
  } else {
    alignmentType = "divergent";
  }

  let summary: string;
  if (alignmentType === "convergent") {
    summary = `Recommendation focus (${recLabel}) esta alinhado com o eixo dominante (${axisLabel}).`;
  } else if (alignmentType === "partially_convergent") {
    summary = `Recommendation focus (${recLabel}) esta alinhado com o eixo secundario, nao o dominante (${axisLabel}).`;
  } else {
    summary = `Recommendation focus (${recLabel}) diverge do eixo dominante (${axisLabel}). Verificar coerencia.`;
  }

  return {
    alignmentType,
    axisFamily,
    axisLabel,
    recommendationFocusFamily: recFamily,
    recommendationFocusLabel: recLabel,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Async DB-querying aggregators (for one-shot queries without pre-loaded state)
// ---------------------------------------------------------------------------

async function listPlanObservabilityRowsByClass(
  classId: string,
  limit: number,
  orderBy: "week_asc" | "computed_desc" = "week_asc"
) {
  const orderClause = orderBy === "computed_desc" ? "computedAt DESC, weekNumber DESC" : "weekNumber ASC";
  return db.getAllAsync<ObservabilitySummaryRow>(
    `SELECT * FROM plan_observability_summaries
     WHERE classId = ?
     ORDER BY ${orderClause}
     LIMIT ?`,
    [classId, Math.max(1, Math.floor(limit))]
  );
}

export async function upsertPlanObservabilitySummary(params: {
  planId: string;
  classId: string;
  cycleId: string;
  weekNumber: number;
  summary: WeeklyObservabilitySummary;
}) {
  try {
    const nowIso = new Date().toISOString();
    const existing = await db.getFirstAsync<{ capturedAt?: string }>(
      `SELECT capturedAt FROM plan_observability_summaries WHERE planId = ? LIMIT 1`,
      [params.planId]
    );
    const capturedAt = String(existing?.capturedAt ?? "").trim() || nowIso;

    await db.runAsync(
      `INSERT OR REPLACE INTO plan_observability_summaries
         (planId, classId, cycleId, weekNumber, summaryJson, capturedAt, computedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.planId,
        params.classId,
        params.cycleId,
        params.weekNumber,
        JSON.stringify(params.summary),
        capturedAt,
        nowIso,
      ]
    );
  } catch (error) {
    console.warn("Failed to save observability summary:", error);
  }
}

export async function listPlanObservabilitySummariesByClass(
  classId: string,
  limit = 32
): Promise<PlanObservabilityRecord[]> {
  try {
    const rows = await listPlanObservabilityRowsByClass(classId, limit, "week_asc");
    return rows.map(toRecord).filter((row): row is PlanObservabilityRecord => Boolean(row));
  } catch (error) {
    console.warn("Failed to load observability summaries:", error);
    return [];
  }
}

export async function getObservabilityTrendByClass(
  classId: string,
  limit = 24
): Promise<ObservabilityTrendByClass> {
  const records = await listPlanObservabilitySummariesByClass(classId, limit);
  if (!records.length) {
    return {
      totalWeeks: 0,
      coherentWeeks: 0,
      coherencePassRate: 0,
      averageCoherenceScore: 0,
      unstableWeeks: 0,
      highSeverityWeeks: 0,
      attentionWeeks: 0,
      authorityViolationWeeks: 0,
    };
  }

  const coherentWeeks = records.filter((record) =>
    record.summary.coherence.every((item) => {
      const coherenceItem = item as { envelopeRespected?: boolean; ok?: boolean };
      return coherenceItem.envelopeRespected ?? coherenceItem.ok ?? false;
    })
  ).length;
  const coherenceScores = records.map((record) => computeCoherenceScore(record.summary));
  const unstableWeeks = records.filter((record) => isUnstableWeek(record.summary)).length;
  const highSeverityWeeks = records.filter((record) =>
    getStabilitySeverity(record.summary) === "high"
  ).length;
  const attentionWeeks = records.filter((record) =>
    getStabilityStatus(record.summary) === "attention"
  ).length;
  const authorityViolationWeeks = records.filter((record) => hasAuthorityViolations(record.summary)).length;

  return {
    totalWeeks: records.length,
    coherentWeeks,
    coherencePassRate: coherentWeeks / records.length,
    averageCoherenceScore:
      coherenceScores.reduce((total, value) => total + value, 0) / Math.max(1, coherenceScores.length),
    unstableWeeks,
    highSeverityWeeks,
    attentionWeeks,
    authorityViolationWeeks,
  };
}

export async function getDriftFrequencyByClass(
  classId: string,
  limit = 24
): Promise<DriftFrequencyByClassItem[]> {
  const records = await listPlanObservabilitySummariesByClass(classId, limit);
  const counters: Record<
    PedagogicalDriftCode,
    {
      total: number;
      low: number;
      medium: number;
      high: number;
    }
  > = {
    weekly_session_misalignment: { total: 0, low: 0, medium: 0, high: 0 },
    weekly_authority_violation: { total: 0, low: 0, medium: 0, high: 0 },
    quarter_week_misalignment: { total: 0, low: 0, medium: 0, high: 0 },
    load_flattening: { total: 0, low: 0, medium: 0, high: 0 },
    repetition_excess: { total: 0, low: 0, medium: 0, high: 0 },
    progression_stagnation: { total: 0, low: 0, medium: 0, high: 0 },
  };

  for (const record of records) {
    for (const signal of record.summary.driftSignals) {
      if (!signal.detected) continue;
      const counter = counters[signal.code];
      if (!counter) continue;
      counter.total += 1;
      counter[signal.severity] += 1;
    }
  }

  return DRIFT_CODES
    .map((code) => ({
      code,
      total: counters[code].total,
      low: counters[code].low,
      medium: counters[code].medium,
      high: counters[code].high,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function getRecentUnstableWeeksByClass(
  classId: string,
  limit = 6
): Promise<UnstableObservabilityWeek[]> {
  try {
    const rows = await listPlanObservabilityRowsByClass(classId, Math.max(limit * 3, 18), "computed_desc");
    const records = rows.map(toRecord).filter((row): row is PlanObservabilityRecord => Boolean(row));
    return records
      .filter((record) => isUnstableWeek(record.summary))
      .slice(0, Math.max(1, Math.floor(limit)))
      .map((record) => ({
        planId: record.planId,
        classId: record.classId,
        cycleId: record.cycleId,
        weekNumber: record.weekNumber,
        coherenceScore: computeCoherenceScore(record.summary),
        driftSignals: record.summary.driftSignals.filter((signal) => signal.detected),
        capturedAt: record.capturedAt,
        computedAt: record.computedAt,
      }));
  } catch (error) {
    console.warn("Failed to load unstable observability weeks:", error);
    return [];
  }
}
