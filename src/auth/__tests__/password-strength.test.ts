import { estimatePasswordStrength } from "../password-strength";

describe("advisory password strength", () => {
  it("values long passwords without requiring symbols or uppercase", () => {
    expect(estimatePasswordStrength("caminhosdistantespelafloresta").label).toBe("Forte");
    expect(estimatePasswordStrength("nuvem pedra janela horizonte").label).toBe("Forte");
  });
  it.each(["asasas", "a".repeat(100), "abcabcabcabcabcabc", "1234567890", "Senha1234!", "Secret123!"])("does not reward predictable input: %s", (value) => {
    expect(estimatePasswordStrength(value).label).toBe("Fraca");
  });
  it("increases for additional length and resets when empty", () => {
    expect(estimatePasswordStrength("rioazul").score).toBeLessThan(estimatePasswordStrength("rioazulvento").score);
    expect(estimatePasswordStrength("rioazulvento").score).toBeLessThan(estimatePasswordStrength("rioazulventopedra").score);
    expect(estimatePasswordStrength("")).toEqual({ score: 0, label: "" });
  });
});
