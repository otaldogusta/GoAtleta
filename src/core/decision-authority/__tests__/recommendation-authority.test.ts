import {
    canRecommendationAutoApply,
    isRecommendationSuggestionOnly,
    RECOMMENDATION_ENGINE_PRINCIPLES,
    requiresTeacherAcceptanceForRecommendation,
} from "../recommendation-authority";

describe("recommendation authority", () => {
  it("remains suggestion-only and requires teacher acceptance", () => {
    expect(canRecommendationAutoApply()).toBe(false);
    expect(isRecommendationSuggestionOnly()).toBe(true);
    expect(requiresTeacherAcceptanceForRecommendation()).toBe(true);
  });

  it("keeps recommendation engine non-intervention principles", () => {
    expect(RECOMMENDATION_ENGINE_PRINCIPLES.doesNotChangeGeneration).toBe(true);
    expect(RECOMMENDATION_ENGINE_PRINCIPLES.doesNotOverrideTeacher).toBe(true);
    expect(RECOMMENDATION_ENGINE_PRINCIPLES.requiresTeacherAcceptance).toBe(true);
    expect(RECOMMENDATION_ENGINE_PRINCIPLES.usesObservabilityOnly).toBe(true);
  });
});
