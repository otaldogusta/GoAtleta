import type {
    ObservabilityRecommendationCode,
    ObservabilityRecommendationDecision,
    ObservabilityRecommendationDecisionReasonType,
    ObservabilityRecommendationDecisionStatus,
    ObservabilityRecommendationPriority,
} from "../core/models";
import { db } from "./sqlite";

type RecommendationDecisionRow = {
  id: string;
  classId: string;
  cycleId: string;
  planId: string;
  weekNumber: number;
  recommendationCode: string;
  status: string;
  priority: string;
  title: string;
  message: string;
  rationale: string;
  sourceSignalsJson: string;
  reasonType?: string | null;
  reasonNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

const parseStringArray = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
};

const toDecision = (
  row: RecommendationDecisionRow | null | undefined
): ObservabilityRecommendationDecision | null => {
  if (!row) return null;

  return {
    id: row.id,
    classId: row.classId,
    cycleId: row.cycleId,
    planId: row.planId,
    weekNumber: row.weekNumber,
    recommendationCode: row.recommendationCode as ObservabilityRecommendationCode,
    status: row.status as ObservabilityRecommendationDecisionStatus,
    priority: row.priority as ObservabilityRecommendationPriority,
    title: row.title,
    message: row.message,
    rationale: row.rationale,
    sourceSignals: parseStringArray(row.sourceSignalsJson),
    reasonType: (row.reasonType ?? null) as ObservabilityRecommendationDecisionReasonType | null,
    reasonNote: row.reasonNote ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export async function upsertRecommendationDecision(
  input: ObservabilityRecommendationDecision
): Promise<void> {
  const existing = await db.getFirstAsync<RecommendationDecisionRow>(
    `SELECT * FROM recommendation_decisions
     WHERE planId = ? AND recommendationCode = ?
     ORDER BY updatedAt DESC
     LIMIT 1`,
    [input.planId, input.recommendationCode]
  );

  if (existing) {
    await db.runAsync(
      `UPDATE recommendation_decisions
       SET classId = ?,
           cycleId = ?,
           weekNumber = ?,
           status = ?,
           priority = ?,
           title = ?,
           message = ?,
           rationale = ?,
           sourceSignalsJson = ?,
           reasonType = ?,
           reasonNote = ?,
           updatedAt = ?
       WHERE id = ?`,
      [
        input.classId,
        input.cycleId,
        input.weekNumber,
        input.status,
        input.priority,
        input.title,
        input.message,
        input.rationale,
        JSON.stringify(input.sourceSignals),
        input.reasonType ?? null,
        input.reasonNote ?? null,
        input.updatedAt,
        existing.id,
      ]
    );
    return;
  }

  await db.runAsync(
    `INSERT INTO recommendation_decisions
      (id, classId, cycleId, planId, weekNumber, recommendationCode, status, priority,
       title, message, rationale, sourceSignalsJson, reasonType, reasonNote, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.classId,
      input.cycleId,
      input.planId,
      input.weekNumber,
      input.recommendationCode,
      input.status,
      input.priority,
      input.title,
      input.message,
      input.rationale,
      JSON.stringify(input.sourceSignals),
      input.reasonType ?? null,
      input.reasonNote ?? null,
      input.createdAt,
      input.updatedAt,
    ]
  );
}

export async function listRecommendationDecisionsByClass(
  classId: string,
  limit = 50
): Promise<ObservabilityRecommendationDecision[]> {
  try {
    const rows = await db.getAllAsync<RecommendationDecisionRow>(
      `SELECT * FROM recommendation_decisions
       WHERE classId = ?
       ORDER BY updatedAt DESC, weekNumber DESC
       LIMIT ?`,
      [classId, Math.max(1, Math.floor(limit))]
    );
    return rows.map(toDecision).filter((item): item is ObservabilityRecommendationDecision => Boolean(item));
  } catch {
    return [];
  }
}

export async function listRecommendationDecisionsByPlan(
  planId: string
): Promise<ObservabilityRecommendationDecision[]> {
  try {
    const rows = await db.getAllAsync<RecommendationDecisionRow>(
      `SELECT * FROM recommendation_decisions
       WHERE planId = ?
       ORDER BY updatedAt DESC`,
      [planId]
    );
    return rows.map(toDecision).filter((item): item is ObservabilityRecommendationDecision => Boolean(item));
  } catch {
    return [];
  }
}

export async function getRecommendationDecisionForPlanAndCode(
  planId: string,
  recommendationCode: ObservabilityRecommendationCode
): Promise<ObservabilityRecommendationDecision | null> {
  try {
    const row = await db.getFirstAsync<RecommendationDecisionRow>(
      `SELECT * FROM recommendation_decisions
       WHERE planId = ? AND recommendationCode = ?
       ORDER BY updatedAt DESC
       LIMIT 1`,
      [planId, recommendationCode]
    );
    return toDecision(row);
  } catch {
    return null;
  }
}
