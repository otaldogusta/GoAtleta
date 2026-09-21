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

  test("does not route a recurring class rule to official regulations", () => {
    const result = isRegulationIntent([
      {
        role: "user",
        content: "Registre como regra recorrente desta turma: a última aula de cada mês é reservada apenas para jogos. Mostre a proposta de regra da turma para eu confirmar antes de salvar.",
      },
    ]);
    expect(result).toBe(false);
  });

  test("keeps official rule questions in the regulation flow", () => {
    const result = isRegulationIntent([
      { role: "user", content: "Pelo regulamento da FIVB, qual regra de substituição do líbero está vigente?" },
    ]);
    expect(result).toBe(true);
  });
});
