export type GuardAuthorityEffect =
  | "enforces_limits"
  | "prevents_regression"
  | "prevents_drift"
  | "caps_load"
  | "preserves_age_band";

export const GUARD_AUTHORITY_PRINCIPLES = {
  doesNotDefineIntent: true,
  doesNotReplaceWeekAuthority: true,
  doesNotReplaceTeacherDecision: true,
  enforcesLimitsOnly: true,
} as const;

export function isGuardAuthorityLimitOnly(): true {
  return true;
}
