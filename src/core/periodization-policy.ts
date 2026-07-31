export type PeriodizationLoadCurveModel = "ondulatorio" | "linear" | "blocos";

export type PeriodizationPolicy = {
  schemaVersion: 1;
  loadModel: PeriodizationLoadCurveModel;
  recoveryWeeks: number;
  intensityMin: number;
  intensityMax: number;
};

export type PeriodizationWeekPolicy = {
  loadModel: PeriodizationLoadCurveModel;
  recoveryWeek: boolean;
  intensity: number;
  rpeTarget: string;
};

export const DEFAULT_PERIODIZATION_POLICY: PeriodizationPolicy = {
  schemaVersion: 1,
  loadModel: "ondulatorio",
  recoveryWeeks: 4,
  intensityMin: 3,
  intensityMax: 6,
};

const PERIODIZATION_DEVELOPMENT_LEVELS = new Set(["MV1", "MV2", "MV3"]);

/**
 * A cycle record can exist before the coach has finished the pedagogical setup.
 * Planning screens must use this readiness check instead of treating that
 * technical record as a configured periodization.
 */
export const isClassPeriodizationConfigured = (
  classGroup?: Pick<
    ClassGroup,
    "goal" | "mvLevel" | "cycleStartDate" | "cycleLengthWeeks"
  > | null,
) =>
  Boolean(
    classGroup &&
    String(classGroup.goal ?? "").trim() &&
    PERIODIZATION_DEVELOPMENT_LEVELS.has(String(classGroup.mvLevel ?? "")) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(classGroup.cycleStartDate ?? "")) &&
    annualCycleOptions.includes(
      Number(
        classGroup.cycleLengthWeeks,
      ) as (typeof annualCycleOptions)[number],
    ),
  );

const clampInteger = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

const isLoadModel = (value: unknown): value is PeriodizationLoadCurveModel =>
  value === "ondulatorio" || value === "linear" || value === "blocos";

export const normalizePeriodizationPolicy = (
  value?: Partial<PeriodizationPolicy> | null,
): PeriodizationPolicy => {
  const intensityMin = clampInteger(
    value?.intensityMin,
    1,
    9,
    DEFAULT_PERIODIZATION_POLICY.intensityMin,
  );
  const intensityMax = clampInteger(
    value?.intensityMax,
    intensityMin + 1,
    10,
    Math.max(intensityMin + 1, DEFAULT_PERIODIZATION_POLICY.intensityMax),
  );

  return {
    schemaVersion: 1,
    loadModel: isLoadModel(value?.loadModel)
      ? value.loadModel
      : DEFAULT_PERIODIZATION_POLICY.loadModel,
    recoveryWeeks: clampInteger(
      value?.recoveryWeeks,
      2,
      8,
      DEFAULT_PERIODIZATION_POLICY.recoveryWeeks,
    ),
    intensityMin,
    intensityMax,
  };
};

export const parsePeriodizationPolicy = (
  serialized?: string | null,
): PeriodizationPolicy => {
  if (!serialized?.trim()) return DEFAULT_PERIODIZATION_POLICY;
  try {
    return normalizePeriodizationPolicy(
      JSON.parse(serialized) as Partial<PeriodizationPolicy>,
    );
  } catch {
    return DEFAULT_PERIODIZATION_POLICY;
  }
};

export const serializePeriodizationPolicy = (
  policy?: Partial<PeriodizationPolicy> | null,
) => JSON.stringify(normalizePeriodizationPolicy(policy));

const resolveLinearIntensity = (
  policy: PeriodizationPolicy,
  weekNumber: number,
  cycleLength: number,
) => {
  const progress =
    cycleLength <= 1
      ? 1
      : Math.min(1, Math.max(0, (weekNumber - 1) / (cycleLength - 1)));
  return Math.round(
    policy.intensityMin +
      (policy.intensityMax - policy.intensityMin) * progress,
  );
};

const resolveBlockIntensity = (
  policy: PeriodizationPolicy,
  weekNumber: number,
  cycleLength: number,
) => {
  const progress = Math.min(
    0.999,
    Math.max(0, (weekNumber - 1) / Math.max(1, cycleLength)),
  );
  if (progress < 1 / 3) return policy.intensityMin;
  if (progress < 2 / 3) {
    return Math.round((policy.intensityMin + policy.intensityMax) / 2);
  }
  return policy.intensityMax;
};

const resolveUndulatingIntensity = (
  policy: PeriodizationPolicy,
  weekNumber: number,
) => {
  const position = (Math.max(1, weekNumber) - 1) % policy.recoveryWeeks;
  const workWeeks = Math.max(1, policy.recoveryWeeks - 1);
  const progress = Math.min(1, position / workWeeks);
  return Math.round(
    policy.intensityMin +
      (policy.intensityMax - policy.intensityMin) * progress,
  );
};

export const resolvePeriodizationWeekPolicy = (params: {
  policy?: Partial<PeriodizationPolicy> | null;
  weekNumber: number;
  cycleLength: number;
}): PeriodizationWeekPolicy => {
  const policy = normalizePeriodizationPolicy(params.policy);
  const weekNumber = Math.max(1, Math.round(params.weekNumber));
  const cycleLength = Math.max(1, Math.round(params.cycleLength));
  const recoveryWeek = weekNumber % policy.recoveryWeeks === 0;

  const calculatedIntensity =
    policy.loadModel === "linear"
      ? resolveLinearIntensity(policy, weekNumber, cycleLength)
      : policy.loadModel === "blocos"
        ? resolveBlockIntensity(policy, weekNumber, cycleLength)
        : resolveUndulatingIntensity(policy, weekNumber);
  const intensity = recoveryWeek
    ? policy.intensityMin
    : Math.min(
        policy.intensityMax,
        Math.max(policy.intensityMin, calculatedIntensity),
      );
  const upperIntensity = Math.min(policy.intensityMax, intensity + 1);

  return {
    loadModel: policy.loadModel,
    recoveryWeek,
    intensity,
    rpeTarget:
      upperIntensity > intensity
        ? `${intensity}-${upperIntensity}`
        : String(intensity),
  };
};
import type { ClassGroup } from "./models";

import { annualCycleOptions } from "./periodization-basics";
