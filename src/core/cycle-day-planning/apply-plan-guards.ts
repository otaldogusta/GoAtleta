import type {
    CycleDayPlanningContext,
    ProgressionDimension,
    RepetitionAdjustment,
    RepetitionRisk,
    SessionStrategy,
} from "../models";
import {
    buildPlanFingerprintSet,
    buildRecentFingerprintSet,
} from "./build-plan-fingerprint";

type ApplyPlanGuardsParams = {
  context: CycleDayPlanningContext;
  strategy: SessionStrategy;
  recentSessions?: CycleDayPlanningContext["recentSessions"];
  recentPlanHashes?: string[];
};

export type ApplyPlanGuardsResult = {
  strategy: SessionStrategy;
  fingerprint: string;
  structuralFingerprint: string;
  repetitionAdjustment: RepetitionAdjustment;
};

const PROGRESSION_LADDER: ProgressionDimension[] = [
  "consistencia",
  "precisao",
  "pressao_tempo",
  "oposicao",
  "tomada_decisao",
  "transferencia_jogo",
];

const PHASE_BOUNDS: Record<
  CycleDayPlanningContext["phaseIntent"],
  { min: ProgressionDimension; max: ProgressionDimension }
> = {
  exploracao_fundamentos: { min: "consistencia", max: "precisao" },
  estabilizacao_tecnica: { min: "precisao", max: "oposicao" },
  aceleracao_decisao: { min: "pressao_tempo", max: "tomada_decisao" },
  transferencia_jogo: { min: "tomada_decisao", max: "transferencia_jogo" },
  pressao_competitiva: { min: "oposicao", max: "transferencia_jogo" },
};

const RISK_SCORE: Record<RepetitionRisk, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

type RepetitionReason = NonNullable<ApplyPlanGuardsResult["reason"]>;

type RepetitionSignal = {
  exactFingerprint: string;
  structuralFingerprint: string;
  sameWeek: boolean;
  weight: number;
};

type RepetitionRiskEvaluation = {
  risk: RepetitionRisk;
  reason?: RepetitionReason;
};

const normalizeDate = (value: string | null | undefined) => {
  const parsed = new Date(`${String(value ?? "").slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getWeekWindowKey = (value: string) => {
  const parsed = normalizeDate(value);
  if (!parsed) return value;
  const day = parsed.getDay() === 0 ? 7 : parsed.getDay();
  const monday = new Date(parsed);
  monday.setDate(parsed.getDate() - (day - 1));
  return monday.toISOString().slice(0, 10);
};

const isSameWeek = (left: string, right: string) => getWeekWindowKey(left) === getWeekWindowKey(right);

const buildSignalWeight = (context: CycleDayPlanningContext, session: CycleDayPlanningContext["recentSessions"][number]) => {
  let weight = 1;
  if (session.wasEditedByTeacher) {
    weight +=
      session.teacherOverrideWeight === "strong"
        ? 3
        : session.teacherOverrideWeight === "medium"
          ? 2
          : 1;
  }
  if (session.wasConfirmedExecuted) {
    weight += 2;
  } else if (session.wasApplied) {
    weight += 1;
  }
  if (isSameWeek(context.sessionDate, session.sessionDate)) {
    weight += 1;
  }
  return weight;
};

const buildRecentSignals = (
  context: CycleDayPlanningContext,
  recentSessions: CycleDayPlanningContext["recentSessions"],
): RepetitionSignal[] =>
  recentSessions.slice(0, 3).map((session) => {
    const fingerprints = buildRecentFingerprintSet(session);
    return {
      exactFingerprint: fingerprints.exactFingerprint,
      structuralFingerprint: fingerprints.structuralFingerprint,
      sameWeek: isSameWeek(context.sessionDate, session.sessionDate),
      weight: buildSignalWeight(context, session),
    };
  });

const evaluateRepetitionRisk = (params: {
  context: CycleDayPlanningContext;
  recentSessions: CycleDayPlanningContext["recentSessions"];
  exactFingerprint: string;
  structuralFingerprint: string;
  recentPlanHashes: string[];
}): RepetitionRiskEvaluation => {
  const recentSignals = buildRecentSignals(params.context, params.recentSessions);
  const exactMatch = recentSignals.find((signal) => signal.exactFingerprint === params.exactFingerprint);
  if (exactMatch) {
    return {
      risk: exactMatch.weight >= 4 ? "high" : "medium",
      reason: "recent_exact_clone",
    };
  }

  if (params.recentPlanHashes.slice(0, 2).includes(params.exactFingerprint)) {
    return {
      risk: "high",
      reason: "recent_plan_hash_repeat",
    };
  }

  const structuralMatches = recentSignals.filter(
    (signal) => signal.structuralFingerprint === params.structuralFingerprint
  );
  if (structuralMatches.length >= 2) {
    return {
      risk: structuralMatches.some((signal) => signal.sameWeek) ? "high" : "medium",
      reason: structuralMatches.some((signal) => signal.sameWeek)
        ? "same_week_structural_repeat"
        : "recent_structural_repeat",
    };
  }

  if (structuralMatches.length === 1 && structuralMatches[0]?.sameWeek) {
    return {
      risk: "medium",
      reason: "same_week_structural_repeat",
    };
  }

  return {
    risk: "none",
  };
};

const createRepetitionAdjustment = (params: {
  risk: RepetitionRisk;
  reason?: RepetitionReason;
  changedFields?: string[];
}): RepetitionAdjustment => ({
  detected: params.risk !== "none",
  risk: params.risk,
  reason: params.reason ?? null,
  changedFields: [...(params.changedFields ?? [])],
});

const createGuardResult = (params: {
  strategy: SessionStrategy;
  fingerprints: { exactFingerprint: string; structuralFingerprint: string };
  adjusted: boolean;
  evaluation: RepetitionRiskEvaluation;
  detectedEvaluation?: RepetitionRiskEvaluation;
  changedFields?: string[];
}): ApplyPlanGuardsResult => {
  const detectedEvaluation = params.detectedEvaluation ?? params.evaluation;
  const repetitionAdjustment = createRepetitionAdjustment({
    risk: detectedEvaluation.risk,
    reason: detectedEvaluation.reason,
    changedFields: params.changedFields,
  });

  return {
    strategy: params.strategy,
    fingerprint: params.fingerprints.exactFingerprint,
    structuralFingerprint: params.fingerprints.structuralFingerprint,
    repetitionAdjustment,
  };
};

const rotateDrillFamilies = (
  strategy: SessionStrategy,
  context: CycleDayPlanningContext
): SessionStrategy | null => {
  const available = context.allowedDrillFamilies.filter(
    (family) => !strategy.forbiddenDrillFamilies.includes(family)
  );
  if (!available.length) return null;

  const rotatedCurrent =
    strategy.drillFamilies.length > 1
      ? [...strategy.drillFamilies.slice(1), strategy.drillFamilies[0]]
      : strategy.drillFamilies;
  const withAlternative = rotatedCurrent.length
    ? rotatedCurrent
    : strategy.drillFamilies;
  const alternative = available.find((family) => !withAlternative.includes(family));
  const nextFamilies = alternative
    ? [...withAlternative.slice(0, Math.max(0, withAlternative.length - 1)), alternative]
    : withAlternative;
  const normalized = Array.from(new Set(nextFamilies)).filter((family) => available.includes(family));
  if (!normalized.length) return null;
  if (JSON.stringify(normalized) === JSON.stringify(strategy.drillFamilies)) return null;

  return {
    ...strategy,
    drillFamilies: normalized,
  };
};

const rotateSecondarySkill = (
  strategy: SessionStrategy,
  context: CycleDayPlanningContext
): SessionStrategy | null => {
  const candidates = [
    context.secondarySkill,
    strategy.secondarySkill,
    context.primarySkill !== strategy.primarySkill ? context.primarySkill : undefined,
  ].filter((skill): skill is NonNullable<SessionStrategy["secondarySkill"]> =>
    Boolean(skill && skill !== strategy.primarySkill && skill !== strategy.secondarySkill)
  );
  const nextSecondarySkill = candidates[0];
  if (!nextSecondarySkill) return null;
  return {
    ...strategy,
    secondarySkill: nextSecondarySkill,
  };
};

const clampProgression = (
  value: ProgressionDimension,
  minValue: ProgressionDimension,
  maxValue: ProgressionDimension
) => {
  const index = PROGRESSION_LADDER.indexOf(value);
  const minIndex = PROGRESSION_LADDER.indexOf(minValue);
  const maxIndex = PROGRESSION_LADDER.indexOf(maxValue);
  if (index < 0 || minIndex < 0 || maxIndex < 0) return value;
  return PROGRESSION_LADDER[Math.min(Math.max(index, minIndex), maxIndex)] ?? value;
};

const shiftProgression = (
  strategy: SessionStrategy,
  context: CycleDayPlanningContext
): SessionStrategy | null => {
  const index = PROGRESSION_LADDER.indexOf(strategy.progressionDimension);
  if (index < 0) return null;
  const phaseBounds = PHASE_BOUNDS[context.phaseIntent];
  const fallbackIndexes =
    strategy.loadIntent === "alto"
      ? [index + 1, index - 1]
      : strategy.loadIntent === "baixo"
        ? [index - 1, index + 1]
        : context.sessionIndexInWeek && context.sessionIndexInWeek > 1
          ? [index + 1, index - 1]
          : [index - 1, index + 1];
  const nextDimension = fallbackIndexes
    .map((candidate) => PROGRESSION_LADDER[candidate])
    .map((candidate) =>
      candidate ? clampProgression(candidate, phaseBounds.min, phaseBounds.max) : undefined
    )
    .find((candidate) => candidate && candidate !== strategy.progressionDimension);
  if (!nextDimension) return null;

  return {
    ...strategy,
    progressionDimension: nextDimension,
  };
};

const varyLevels = (strategy: SessionStrategy, context: CycleDayPlanningContext): SessionStrategy | null => {
  const nextTimePressure =
    strategy.loadIntent === "alto"
      ? strategy.timePressureLevel === "low"
        ? "medium"
        : "high"
      : strategy.loadIntent === "baixo"
        ? strategy.timePressureLevel === "high"
          ? "medium"
          : "low"
        : strategy.timePressureLevel === "medium"
          ? context.sessionIndexInWeek && context.sessionIndexInWeek > 1
            ? "high"
            : "low"
          : "medium";

  const nextGameTransfer =
    strategy.loadIntent === "alto"
      ? strategy.gameTransferLevel === "low"
        ? "medium"
        : "high"
      : strategy.loadIntent === "baixo"
        ? strategy.gameTransferLevel === "high"
          ? "medium"
          : "low"
        : strategy.gameTransferLevel;

  if (
    nextTimePressure === strategy.timePressureLevel &&
    nextGameTransfer === strategy.gameTransferLevel
  ) {
    return null;
  }

  return {
    ...strategy,
    timePressureLevel: nextTimePressure,
    gameTransferLevel: nextGameTransfer,
  };
};

export const resolveVariationCandidates = (params: {
  strategy: SessionStrategy;
  context: CycleDayPlanningContext;
  reason?: RepetitionReason;
}): Array<{ strategy: SessionStrategy; changedFields: string[] }> => {
  const candidates: Array<{ strategy: SessionStrategy; changedFields: string[] }> = [];

  const familyCandidate = rotateDrillFamilies(params.strategy, params.context);
  if (familyCandidate) {
    candidates.push({
      strategy: familyCandidate,
      changedFields: ["drillFamilies"],
    });
  }

  const progressionCandidate = shiftProgression(params.strategy, params.context);
  if (progressionCandidate) {
    candidates.push({
      strategy: progressionCandidate,
      changedFields: ["progressionDimension"],
    });
  }

  const secondarySkillCandidate = rotateSecondarySkill(params.strategy, params.context);
  if (secondarySkillCandidate) {
    candidates.push({
      strategy: secondarySkillCandidate,
      changedFields: ["secondarySkill"],
    });
  }

  const levelCandidate = varyLevels(params.strategy, params.context);
  if (levelCandidate) {
    candidates.push({
      strategy: levelCandidate,
      changedFields: ["timePressureLevel", "gameTransferLevel"],
    });
  }

  if (params.reason === "same_week_structural_repeat") {
    return [
      ...candidates.filter((candidate) => candidate.changedFields.includes("progressionDimension")),
      ...candidates.filter((candidate) => !candidate.changedFields.includes("progressionDimension")),
    ];
  }

  return candidates;
};

export const applyPlanGuards = (params: ApplyPlanGuardsParams): ApplyPlanGuardsResult => {
  const recentSessions = params.recentSessions ?? params.context.recentSessions;
  const recentPlanHashes = (params.recentPlanHashes ?? []).map((value) => String(value ?? "").trim()).filter(Boolean);
  const initialFingerprints = buildPlanFingerprintSet({
    context: params.context,
    strategy: params.strategy,
  });

  if (params.context.historicalConfidence === "none") {
    return createGuardResult({
      strategy: params.strategy,
      adjusted: false,
      evaluation: { risk: "none" },
      fingerprints: initialFingerprints,
    });
  }

  const initialEvaluation = evaluateRepetitionRisk({
    context: params.context,
    recentSessions,
    exactFingerprint: initialFingerprints.exactFingerprint,
    structuralFingerprint: initialFingerprints.structuralFingerprint,
    recentPlanHashes,
  });
  if (initialEvaluation.risk === "none") {
    return createGuardResult({
      strategy: params.strategy,
      adjusted: false,
      evaluation: initialEvaluation,
      fingerprints: initialFingerprints,
    });
  }

  const candidates = resolveVariationCandidates({
    strategy: params.strategy,
    context: params.context,
    reason: initialEvaluation.reason,
  });

  for (const candidate of candidates) {
    const candidateFingerprints = buildPlanFingerprintSet({
      context: params.context,
      strategy: candidate.strategy,
    });
    const evaluation = evaluateRepetitionRisk({
      context: params.context,
      recentSessions,
      exactFingerprint: candidateFingerprints.exactFingerprint,
      structuralFingerprint: candidateFingerprints.structuralFingerprint,
      recentPlanHashes,
    });
    if (
      evaluation.risk === "none" ||
      RISK_SCORE[evaluation.risk] < RISK_SCORE[initialEvaluation.risk]
    ) {
      return createGuardResult({
        strategy: candidate.strategy,
        fingerprints: candidateFingerprints,
        adjusted: true,
        evaluation,
        detectedEvaluation: initialEvaluation,
        changedFields: candidate.changedFields,
      });
    }
  }

  return createGuardResult({
    strategy: params.strategy,
    adjusted: false,
    evaluation: initialEvaluation,
    fingerprints: initialFingerprints,
  });
};
