import type {
    CycleDayPlanningContext,
    PlanFingerprint,
    PlanFingerprintSet,
    RecentSessionSummary,
    SessionStrategy,
    WeeklyLoadIntent,
} from "../models";

type BuildPlanFingerprintParams = {
  context: Pick<CycleDayPlanningContext, "dominantBlock" | "planningPhase" | "sessionIndexInWeek">;
  strategy: SessionStrategy;
};

const normalizeText = (value: string | null | undefined) => String(value ?? "").trim();

const normalizeFamilies = (families: string[] | null | undefined) =>
  (families ?? []).map((family) => normalizeText(family)).filter(Boolean);

const normalizeLoadIntent = (value: string | null | undefined): WeeklyLoadIntent | undefined => {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "baixo" || normalized === "moderado" || normalized === "alto") {
    return normalized;
  }
  return undefined;
};

const serializeParts = (parts: Array<string | number | undefined>) =>
  parts.map((part) => String(part ?? "")).join(":");

export const buildPlanFingerprint = (params: BuildPlanFingerprintParams): PlanFingerprint => ({
  primarySkill: params.strategy.primarySkill,
  secondarySkill: params.strategy.secondarySkill,
  progressionDimension: params.strategy.progressionDimension,
  dominantBlock: normalizeText(params.context.dominantBlock) || undefined,
  periodizationPhase: params.context.planningPhase,
  sessionIndexInWeek:
    typeof params.context.sessionIndexInWeek === "number" ? params.context.sessionIndexInWeek : undefined,
  pedagogicalIntent: params.strategy.pedagogicalIntent,
  drillFamilies: normalizeFamilies(params.strategy.drillFamilies),
  loadIntent: params.strategy.loadIntent,
  oppositionLevel: params.strategy.oppositionLevel,
  timePressureLevel: params.strategy.timePressureLevel,
  gameTransferLevel: params.strategy.gameTransferLevel,
});

export const serializePlanFingerprint = (fingerprint: PlanFingerprint): string =>
  serializeParts([
    fingerprint.primarySkill,
    fingerprint.secondarySkill ?? "",
    fingerprint.progressionDimension,
    fingerprint.dominantBlock ?? "",
    fingerprint.periodizationPhase ?? "",
    fingerprint.sessionIndexInWeek ?? "",
    fingerprint.pedagogicalIntent ?? "",
    fingerprint.oppositionLevel ?? "",
    fingerprint.timePressureLevel ?? "",
    fingerprint.gameTransferLevel ?? "",
    fingerprint.drillFamilies.join("+"),
    fingerprint.loadIntent,
  ]);

export const serializeStructuralPlanFingerprint = (fingerprint: PlanFingerprint): string =>
  serializeParts([
    fingerprint.primarySkill,
    fingerprint.dominantBlock ?? "",
    fingerprint.progressionDimension,
    fingerprint.loadIntent,
  ]);

export const buildPlanFingerprintSet = (params: BuildPlanFingerprintParams): PlanFingerprintSet => {
  const fingerprint = buildPlanFingerprint(params);
  return {
    exactFingerprint: serializePlanFingerprint(fingerprint),
    structuralFingerprint: serializeStructuralPlanFingerprint(fingerprint),
  };
};

export const buildRecentFingerprintSet = (summary: RecentSessionSummary): PlanFingerprintSet => {
  const exactFingerprint = normalizeText(summary.fingerprint);
  const structuralFingerprint = normalizeText(summary.structuralFingerprint);

  if (exactFingerprint && structuralFingerprint) {
    return {
      exactFingerprint,
      structuralFingerprint,
    };
  }

  const fallbackFingerprint: PlanFingerprint = {
    primarySkill: summary.primarySkill ?? "passe",
    secondarySkill: summary.secondarySkill,
    progressionDimension: summary.progressionDimension ?? "consistencia",
    dominantBlock: normalizeText(summary.dominantBlock) || undefined,
    drillFamilies: [],
    loadIntent: normalizeLoadIntent(exactFingerprint.split(":").at(-1)) ?? "moderado",
  };

  return {
    exactFingerprint: exactFingerprint || serializePlanFingerprint(fallbackFingerprint),
    structuralFingerprint:
      structuralFingerprint || serializeStructuralPlanFingerprint(fallbackFingerprint),
  };
};

export const getRecentFingerprintValue = (summary: RecentSessionSummary) =>
  buildRecentFingerprintSet(summary).exactFingerprint;
