import { translateMethodology } from "../methodology/methodology-translator";

describe("methodology-translator", () => {
  it("returns ludic mode for younger age bands", () => {
    const result = translateMethodology({
      ageBand: "08-10",
      objectiveHint: "passe e controle de bola",
      sessionDurationMinutes: 60,
      classSize: 12,
    });

    expect(result.mode).toBe("ludic");
    expect(result.tags.length).toBeGreaterThan(0);
    expect(result.requiresHumanApproval).toBe(true);
  });

  it("returns performance mode for high pedagogical temperature", () => {
    const result = translateMethodology({
      ageBand: "15-17",
      pedagogicalTemperature: 85,
      objectiveHint: "pressão de saque",
    });

    expect(result.mode).toBe("performance");
    expect(result.tips.some((tip) => tip.toLowerCase().includes("critério"))).toBe(true);
  });
});
