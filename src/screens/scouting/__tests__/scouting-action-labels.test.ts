import {
  getDefaultQualityOptionForSkill,
  getScoutingQualityOptionsForSkill,
  resolveScoutingQualityOption,
} from "../scouting-action-labels";

describe("scouting-action-labels", () => {
  test("receive uses volleyball labels", () => {
    const options = getScoutingQualityOptionsForSkill("receive");
    expect(options.map((item) => item.label)).toEqual(["Erro", "C / Baixo", "B / Médio", "A / Alto"]);
  });

  test("serve uses volleyball labels", () => {
    const options = getScoutingQualityOptionsForSkill("serve");
    expect(options.map((item) => item.label)).toEqual(["Erro", "Entrou", "Dificultou", "Ace"]);
  });

  test("attack uses volleyball labels", () => {
    const options = getScoutingQualityOptionsForSkill("attack");
    expect(options.map((item) => item.label)).toEqual(["Erro", "Continuidade", "Bloqueado", "Ponto"]);
  });

  test("defense uses volleyball labels", () => {
    const options = getScoutingQualityOptionsForSkill("defense");
    expect(options.map((item) => item.label)).toEqual([
      "Não defendeu",
      "Manteve viva",
      "Defesa boa",
      "Contra-ataque",
    ]);
  });

  test("communication uses volleyball labels", () => {
    const options = getScoutingQualityOptionsForSkill("communication");
    expect(options.map((item) => item.label)).toEqual(["Ausente", "Tardia", "Clara", "Liderou ação"]);
  });

  test("resolveScoutingQualityOption returns mapping payload", () => {
    expect(resolveScoutingQualityOption("serve", "ace")).toMatchObject({
      quality: "excellent",
      score: 3,
      actionType: "ace",
    });
    expect(resolveScoutingQualityOption("receive", "pass_b")).toMatchObject({
      quality: "medium",
      score: 2,
      actionType: "pass_b",
    });
  });

  test("switching skill changes default", () => {
    expect(getDefaultQualityOptionForSkill("receive").id).toBe("error");
    expect(getDefaultQualityOptionForSkill("communication").id).toBe("absent");
  });
});
