export const RECOMMENDATION_AUTHORITY = {
  suggestsOnly: true,
  canAutoApply: false,
  requiresTeacherAcceptance: true,
} as const;

export const RECOMMENDATION_ENGINE_PRINCIPLES = {
  doesNotChangeGeneration: true,
  doesNotOverrideTeacher: true,
  requiresTeacherAcceptance: true,
  usesObservabilityOnly: true,
} as const;

export function requiresTeacherAcceptanceForRecommendation(): boolean {
  return RECOMMENDATION_AUTHORITY.requiresTeacherAcceptance;
}

export function canRecommendationAutoApply(): false {
  return false;
}

export function isRecommendationSuggestionOnly(): true {
  return true;
}
