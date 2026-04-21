import type { PedagogicalDriftCode, WeeklyObservabilitySummary } from "../core/models";
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
  | "quarter_closing_consistency";

export type ObservabilityInsight = {
  code: ObservabilityInsightCode;
  severity: "info" | "warning" | "critical";
  message: string;
};

const DRIFT_CODES: PedagogicalDriftCode[] = [
  "weekly_session_misalignment",
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
  const ok = summary.coherence.filter((item) => item.ok).length;
  return ok / total;
};

const isUnstableWeek = (summary: WeeklyObservabilitySummary) => {
  const hasMediumOrHighDrift = summary.driftSignals.some(
    (signal) => signal.detected && (signal.severity === "medium" || signal.severity === "high")
  );
  return hasMediumOrHighDrift || computeCoherenceScore(summary) < 1;
};

const formatDriftCodeLabel = (code: PedagogicalDriftCode) => code.replace(/_/g, " ");

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
    };
  }
  const coherentWeeks = records.filter((r) => r.summary.coherence.every((item) => item.ok)).length;
  const coherenceScores = records.map((r) => computeCoherenceScore(r.summary));
  const unstableWeeks = records.filter((r) => isUnstableWeek(r.summary)).length;
  const highSeverityWeeks = records.filter((r) =>
    r.summary.driftSignals.some((signal) => signal.detected && signal.severity === "high")
  ).length;
  return {
    totalWeeks: records.length,
    coherentWeeks,
    coherencePassRate: coherentWeeks / records.length,
    averageCoherenceScore:
      coherenceScores.reduce((total, v) => total + v, 0) / Math.max(1, coherenceScores.length),
    unstableWeeks,
    highSeverityWeeks,
  };
}

export function computeDriftFrequencyFromRecords(
  records: PlanObservabilityRecord[]
): DriftFrequencyByClassItem[] {
  const counters: Record<PedagogicalDriftCode, { total: number; low: number; medium: number; high: number }> = {
    weekly_session_misalignment: { total: 0, low: 0, medium: 0, high: 0 },
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
        severity: "warning",
        message: "A turma apresentou queda de coerencia nas ultimas semanas.",
      });
    }
  }

  const driftFrequency = computeDriftFrequencyFromRecords(byWeekAsc).find((item) => item.total > 0);
  if (driftFrequency) {
    const severeCount = driftFrequency.medium + driftFrequency.high;
    insights.push({
      code: "top_recurring_drift",
      severity: severeCount >= 2 ? "warning" : "info",
      message: `O drift mais recorrente e ${formatDriftCodeLabel(driftFrequency.code)} (${driftFrequency.total} ocorrencias).`,
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
        message: `Ha concentracao de semanas instaveis no trimestre atual (${latestQuarter}).`,
      });
    }

    const expectedClosingType = latest.summary.closingType;
    const closingConsistent = quarterRecords.every(
      (record) => record.summary.closingType === expectedClosingType
    );
    insights.push({
      code: "quarter_closing_consistency",
      severity: closingConsistent ? "info" : "warning",
      message: closingConsistent
        ? `O fechamento trimestral esta consistente no ${latestQuarter}.`
        : `O fechamento trimestral esta inconsistente no ${latestQuarter}.`,
    });
  }

  return insights;
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
    };
  }

  const coherentWeeks = records.filter((record) => record.summary.coherence.every((item) => item.ok)).length;
  const coherenceScores = records.map((record) => computeCoherenceScore(record.summary));
  const unstableWeeks = records.filter((record) => isUnstableWeek(record.summary)).length;
  const highSeverityWeeks = records.filter((record) =>
    record.summary.driftSignals.some((signal) => signal.detected && signal.severity === "high")
  ).length;

  return {
    totalWeeks: records.length,
    coherentWeeks,
    coherencePassRate: coherentWeeks / records.length,
    averageCoherenceScore:
      coherenceScores.reduce((total, value) => total + value, 0) / Math.max(1, coherenceScores.length),
    unstableWeeks,
    highSeverityWeeks,
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
