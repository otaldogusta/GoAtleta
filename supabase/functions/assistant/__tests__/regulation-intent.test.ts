import { isRegulationIntent } from "../regulation-intent";

describe("regulation intent classifier", () => {
  test("matches regulation queries", () => {
    const result = isRegulationIntent([
      { role: "user", content: "Qual regra vale no proximo torneio?" },
    ]);
    expect(result).toBe(true);
  });

  test("ignores generic training query", () => {
    const result = isRegulationIntent([
      { role: "user", content: "Monte um treino de 60 minutos para saque" },
    ]);
    expect(result).toBe(false);
  });
});
