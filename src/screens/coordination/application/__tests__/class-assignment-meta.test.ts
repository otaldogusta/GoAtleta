import {
  formatClassAssignmentMeta,
  getClassAssignmentScheduleLabels,
  groupClassAssignments,
} from "../class-assignment-meta";

describe("formatClassAssignmentMeta", () => {
  it("combina unidade, dias e horário em uma única linha operacional", () => {
    expect(
      formatClassAssignmentMeta({
        unit: "Capão da Imbuia",
        daysOfWeek: [5, 3],
        startTime: "18:00:00",
        endTime: "19:00:00",
      })
    ).toBe("Capão da Imbuia · Qua, Sex · 18:00–19:00");
  });

  it("omite apenas os dados de agenda que não existem", () => {
    expect(
      formatClassAssignmentMeta({
        unit: "Rede Esportes Pinhais",
      })
    ).toBe("Rede Esportes Pinhais");
  });

  it("expõe dias e horário separadamente para a interface", () => {
    expect(
      getClassAssignmentScheduleLabels({
        daysOfWeek: [5, 3],
        startTime: "18:00:00",
        endTime: "19:00:00",
      })
    ).toEqual({
      daysLabel: "Qua, Sex",
      timeLabel: "18:00–19:00",
    });
  });

  it("agrupa por unidade e ordena as turmas por dia, horário e nome", () => {
    const groups = groupClassAssignments([
      {
        id: "3",
        name: "Cats",
        unit: "Rede Esportes Pinhais",
        daysOfWeek: [1, 3],
        startTime: "16:00",
      },
      {
        id: "1",
        name: "Capivaras",
        unit: "Capão da Imbuia",
        daysOfWeek: [3, 5],
        startTime: "18:00",
      },
      {
        id: "2",
        name: "Bem-te-vi Laranja",
        unit: "Rede Esportes Pinhais",
        daysOfWeek: [1, 3],
        startTime: "10:00",
      },
    ]);

    expect(groups.map((group) => group.unit)).toEqual([
      "Capão da Imbuia",
      "Rede Esportes Pinhais",
    ]);
    expect(groups[1].classes.map((classGroup) => classGroup.name)).toEqual([
      "Bem-te-vi Laranja",
      "Cats",
    ]);
  });
});
