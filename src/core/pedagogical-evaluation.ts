import type { VolleyballSkill } from "./models";
import { getSkillMetrics, type ScoutingCounts } from "./scouting";

// ---------------------------------------------------------------------------
// Configuration — all numeric thresholds in one place for field tuning
// ---------------------------------------------------------------------------
const EVAL_CONFIG = {
  THRESHOLD_BASE: 5,
  THRESHOLD_MIN: 4,
  THRESHOLD_MAX: 10,
  THRESHOLD_CONFIDENCE_BONUS: 1,         // subtracted when confidence is "alto"
  GAP_RESIDUAL_MAX: 3,                   // |gap| ≤ 3  → residual
  GAP_PEQUENO_MAX: 8,                    // |gap| ≤ 8  → pequeno
  GAP_MODERADO_MAX: 18,                  // |gap| ≤ 18 → moderado; > 18 → critico
  CONSISTENCY_RECENCY_DECAY: 0.3,        // geometric weight decay per step back
  CONSISTENCY_DEVIATION_SCALE: 4,        // stddev → consistency penalty scale
  DECISION_INCREASE_CONSISTENCY_MIN: 70, // min consistency to allow increase at residual gap
} as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export type GapLevel = "residual" | "pequeno" | "moderado" | "critico";
export type GapDirection = "deficit" | "superavit";
export type GapAnalysis = {
  value: number;
  level: GapLevel;
  direction: GapDirection;
};

export type SessionOutcomeAdjustment = "increase" | "maintain" | "regress";
export type SampleConfidence = "baixo" | "medio" | "alto";

export type SessionSkillHistoryEntry = {
  date: string;
  performanceScore: number;
};

export type SessionOutcomeEvaluation = {
  achieved: boolean;
  performanceScore: number;
  adjustment: SessionOutcomeAdjustment;
  targetScore: number;
  evidence: string;
  sampleConfidence: SampleConfidence;
  learningVelocity: number;
  consistencyScore: number;
  deltaFromPrevious: number | null;
  gap: GapAnalysis;
  skillLearningState: {
    skill: VolleyballSkill;
    level: "instavel" | "consolidando" | "consistente";
    trend: "subindo" | "estagnado" | "caindo";
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mapSkillToScouting = (skill: VolleyballSkill): keyof ScoutingCounts => {
  if (skill === "saque") return "serve";
  if (skill === "passe") return "receive";
  if (skill === "levantamento") return "set";
  return "attack_send";
};

const extractTargetPercent = (criteria: string[]) => {
  const values = criteria
    .map((item) => String(item ?? ""))
    .map((item) => item.match(/(\d{1,3})\s*%/))
    .map((match) => (match ? Number(match[1]) : Number.NaN))
    .filter((value) => Number.isFinite(value) && value >= 30 && value <= 100);

  if (!values.length) return 70;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};

/**
 * Recency-weighted consistency score (0–100).
 * Recent sessions carry exponentially more weight than older ones.
 * Decay factor: CONSISTENCY_RECENCY_DECAY applied per step back from latest.
 */
const resolveConsistencyScore = (scores: number[]): number => {
  if (scores.length < 2) return 50;
  const n = scores.length;
  const decay = EVAL_CONFIG.CONSISTENCY_RECENCY_DECAY;
  // i=0 is oldest → weight = decay^(n-1); i=n-1 is newest → weight = 1
  const weights = scores.map((_, i) => Math.pow(decay, n - 1 - i));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const normalizedWeights = weights.map((w) => w / weightSum);

  const mean = scores.reduce((sum, score, i) => sum + score * normalizedWeights[i], 0);
  const variance = scores.reduce(
    (sum, score, i) => sum + normalizedWeights[i] * (score - mean) ** 2,
    0
  );
  const weightedStdDev = Math.sqrt(variance);
  return Math.max(
    0,
    Math.min(100, Math.round(100 - weightedStdDev * EVAL_CONFIG.CONSISTENCY_DEVIATION_SCALE))
  );
};

/**
 * Adaptive trend threshold — scales with historical variability.
 * More volatile history → higher threshold (conservador: 4–10).
 * High sample confidence lowers the threshold by confidenceBonus.
 */
const resolveAdaptiveThreshold = (
  history: SessionSkillHistoryEntry[],
  confidence: SampleConfidence
): number => {
  const scores = history.map((h) => h.performanceScore).filter(Number.isFinite);
  if (!scores.length) return EVAL_CONFIG.THRESHOLD_BASE;
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);
  const confidenceBonus =
    confidence === "alto" ? EVAL_CONFIG.THRESHOLD_CONFIDENCE_BONUS : 0;
  return Math.max(
    EVAL_CONFIG.THRESHOLD_MIN,
    Math.min(
      EVAL_CONFIG.THRESHOLD_MAX,
      EVAL_CONFIG.THRESHOLD_BASE + stddev * 0.5 - confidenceBonus
    )
  );
};

/**
 * Structured gap analysis: signed = target − performance.
 * Positive → deficit (below target); negative → superavit (above target).
 */
const resolveGapAnalysis = (performanceScore: number, targetScore: number): GapAnalysis => {
  const signed = targetScore - performanceScore;
  const abs = Math.abs(signed);
  let level: GapLevel;
  if (abs <= EVAL_CONFIG.GAP_RESIDUAL_MAX) {
    level = "residual";
  } else if (abs <= EVAL_CONFIG.GAP_PEQUENO_MAX) {
    level = "pequeno";
  } else if (abs <= EVAL_CONFIG.GAP_MODERADO_MAX) {
    level = "moderado";
  } else {
    level = "critico";
  }
  return { value: signed, level, direction: signed > 0 ? "deficit" : "superavit" };
};

/**
 * Learning velocity: change from oldest to current over the observed window.
 * Uses per-day velocity when the temporal span is valid; falls back to per-session.
 */
const resolveLearningVelocity = (
  history: SessionSkillHistoryEntry[],
  currentScore: number
): number => {
  if (!history.length) return 0;
  const oldest = history[0];
  const delta = currentScore - oldest.performanceScore;
  const oldestMs = Date.parse(oldest.date);
  const daysBetween = Number.isFinite(oldestMs)
    ? (Date.now() - oldestMs) / 86_400_000
    : Number.NaN;
  if (Number.isFinite(daysBetween) && daysBetween >= 1) {
    return Number((delta / daysBetween).toFixed(2));
  }
  return Number((delta / Math.max(1, history.length)).toFixed(2));
};

const resolveLearningLevel = (score: number, consistencyScore: number) => {
  if (score >= 80 && consistencyScore >= 70) return "consistente" as const;
  if (score >= 60) return "consolidando" as const;
  return "instavel" as const;
};

const resolveSampleConfidence = (total: number): SampleConfidence => {
  if (total >= 20) return "alto";
  if (total >= 10) return "medio";
  return "baixo";
};

// ---------------------------------------------------------------------------
// Deterministic decision matrix — the cognitive core of the adaptive system
// ---------------------------------------------------------------------------
const resolveAdjustment = (
  gap: GapAnalysis,
  trend: "subindo" | "estagnado" | "caindo",
  consistencyScore: number,
  sampleConfidence: SampleConfidence
): SessionOutcomeAdjustment => {
  // Guard: low confidence → always maintain (never commit to regression or early increase)
  if (sampleConfidence === "baixo") return "maintain";

  if (gap.level === "critico") {
    // Regression only when gap is critical AND already falling — trend improving → hold
    return trend === "caindo" ? "regress" : "maintain";
  }

  if (gap.level === "moderado") return "maintain";

  if (gap.level === "pequeno") {
    return trend === "subindo" ? "increase" : "maintain";
  }

  // residual gap — increase only when consistency confirms stability
  return consistencyScore > EVAL_CONFIG.DECISION_INCREASE_CONSISTENCY_MIN
    ? "increase"
    : "maintain";
};

// ---------------------------------------------------------------------------
// Main evaluator
// ---------------------------------------------------------------------------
export const evaluateSessionOutcome = (params: {
  focusSkill: VolleyballSkill;
  successCriteria: string[];
  scoutingCounts: ScoutingCounts;
  history?: SessionSkillHistoryEntry[];
}): SessionOutcomeEvaluation => {
  const scoutingKey = mapSkillToScouting(params.focusSkill);
  const metrics = getSkillMetrics(params.scoutingCounts[scoutingKey]);
  const performanceScore = Math.round((metrics.avg / 2) * 100);
  const targetScore = extractTargetPercent(params.successCriteria);
  const minSamples = Math.max(10, Math.ceil(targetScore / 5));
  const sampleConfidence = resolveSampleConfidence(metrics.total);

  const history = [...(params.history ?? [])]
    .filter((item) => Number.isFinite(item.performanceScore))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const previousScore = history.length ? history[history.length - 1].performanceScore : null;
  const deltaFromPrevious =
    previousScore !== null ? Number((performanceScore - previousScore).toFixed(1)) : null;

  const adaptiveThreshold = resolveAdaptiveThreshold(history, sampleConfidence);
  const trend =
    deltaFromPrevious === null
      ? "estagnado"
      : deltaFromPrevious > adaptiveThreshold
      ? "subindo"
      : deltaFromPrevious < -adaptiveThreshold
      ? "caindo"
      : "estagnado";

  const scoresForConsistency = [...history.map((h) => h.performanceScore), performanceScore];
  const consistencyScore = resolveConsistencyScore(scoresForConsistency);
  const learningVelocity = resolveLearningVelocity(history, performanceScore);

  const gap = resolveGapAnalysis(performanceScore, targetScore);
  const adjustment = resolveAdjustment(gap, trend, consistencyScore, sampleConfidence);
  const achieved = metrics.total >= minSamples && performanceScore >= targetScore;

  const gapSign = gap.direction === "deficit" ? "-" : "+";
  const evidence =
    metrics.total < minSamples
      ? `Amostra insuf. (${metrics.total}/${minSamples}). Confianca: ${sampleConfidence}.`
      : `Gap: ${gap.level} (${gapSign}${Math.abs(gap.value)}%) · Tendencia: ${trend} · Decisao: ${
          adjustment === "increase" ? "aumentar" : adjustment === "regress" ? "regredir" : "manter"
        }.`;

  return {
    achieved,
    performanceScore,
    adjustment,
    targetScore,
    evidence,
    sampleConfidence,
    learningVelocity,
    consistencyScore,
    deltaFromPrevious,
    gap,
    skillLearningState: {
      skill: params.focusSkill,
      level: resolveLearningLevel(performanceScore, consistencyScore),
      trend,
    },
  };
};
