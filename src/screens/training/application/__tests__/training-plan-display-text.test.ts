import { formatTrainingPlanDisplayText } from "../training-plan-display-text";

describe("formatTrainingPlanDisplayText", () => {
  it("normalizes common imported Portuguese planning text for display", () => {
    expect(formatTrainingPlanDisplayText("Semana 01 - Adaptacao")).toBe(
      "Semana 01 - Adaptação"
    );
    expect(
      formatTrainingPlanDisplayText(
        "Desenvolver coordenacao motora com adaptacoes, recepcao e transicao."
      )
    ).toBe(
      "Desenvolver coordenação motora com adaptações, recepção e transição."
    );
    expect(formatTrainingPlanDisplayText("Lancar + palmas; quique max 1x")).toBe(
      "Lançar + palmas; quique máx. 1x"
    );
  });

  it("decodes mojibake before applying display normalization", () => {
    expect(formatTrainingPlanDisplayText("CoordenaÃ§Ã£o e adaptaÃ§Ãµes")).toBe(
      "Coordenação e adaptações"
    );
  });
});
