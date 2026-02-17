import { computePositionWeightedScore } from "../positions/position-matrix";

describe("position-matrix", () => {
  it("favors key skills for libero profile", () => {
    const score = computePositionWeightedScore("libero", {
      passe: 8,
      defesa: 8,
      ataque: 3,
      bloqueio: 2,
      saque: 6,
      levantamento: 5,
      transicao: 7,
    });

    expect(score).toBeGreaterThan(6);
  });

  it("returns zero when there are no valid values", () => {
    const score = computePositionWeightedScore("levantador", {});
    expect(score).toBe(0);
  });
});
