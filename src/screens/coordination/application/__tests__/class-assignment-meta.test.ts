import { formatClassAssignmentMeta } from "../class-assignment-meta";

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
});
