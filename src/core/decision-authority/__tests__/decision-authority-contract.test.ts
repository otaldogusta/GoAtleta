import {
    DECISION_AUTHORITY_CANONICAL_CHAIN,
    getDecisionAuthorityPower,
    isDirectiveLayer,
    isObservationalLayer,
    isSuggestionLayer,
} from "../decision-authority-contract";

describe("decision authority contract", () => {
  it("keeps the canonical authority chain stable", () => {
    expect(getDecisionAuthorityPower("quarter")).toBe("guides_direction");
    expect(getDecisionAuthorityPower("week")).toBe("defines_intention");
    expect(getDecisionAuthorityPower("session")).toBe("defines_execution");
    expect(getDecisionAuthorityPower("guard")).toBe("enforces_limits");
    expect(getDecisionAuthorityPower("qa")).toBe("observes_only");
    expect(getDecisionAuthorityPower("recommendation")).toBe("suggests_only");
    expect(getDecisionAuthorityPower("teacher")).toBe("final_decision");
  });

  it("classifies observational, suggestion and directive layers", () => {
    expect(isObservationalLayer("qa")).toBe(true);
    expect(isObservationalLayer("week")).toBe(false);

    expect(isSuggestionLayer("recommendation")).toBe(true);
    expect(isSuggestionLayer("session")).toBe(false);

    expect(isDirectiveLayer("quarter")).toBe(true);
    expect(isDirectiveLayer("week")).toBe(true);
    expect(isDirectiveLayer("session")).toBe(true);
    expect(isDirectiveLayer("guard")).toBe(true);
    expect(isDirectiveLayer("qa")).toBe(false);
    expect(isDirectiveLayer("recommendation")).toBe(false);
    expect(isDirectiveLayer("teacher")).toBe(false);
  });

  it("exposes the canonical constitutional chain", () => {
    expect(DECISION_AUTHORITY_CANONICAL_CHAIN).toEqual([
      "Trimestre orienta direcao.",
      "Semana define intencao.",
      "Sessao define execucao.",
      "Guards impoem limites.",
      "QA observa.",
      "Recommendation sugere.",
      "Professor decide.",
    ]);
  });
});
