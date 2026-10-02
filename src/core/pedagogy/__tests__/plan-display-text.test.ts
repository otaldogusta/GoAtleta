import { formatPedagogicalDisplayText as text } from "../plan-display-text";

describe("Portuguese pedagogical display text", () => {
  it("repairs generated objective labels and historic block names", () => {
    expect(text("Precisao e estabilizacao tecnica, priorizando adaptacao a pressao, levantamento / consistencia / main, sem repetir bloco main."))
      .toBe("Precisão e estabilização técnica, priorizando adaptação à pressão, levantamento / consistência / parte principal, sem repetir bloco parte principal.");
  });
  it("preserves line breaks, canonical identifiers and URLs", () => {
    expect(text("Conceitual: precisao\nAtitudinal: cooperacao\nProcedimental: transicao"))
      .toBe("Conceitual: precisão\nAtitudinal: cooperação\nProcedimental: transição");
    expect(text("estabilizacao_tecnica class_based_bootstrap main_id https://example.org/precisao/main `consistencia`"))
      .toBe("estabilizacao_tecnica class_based_bootstrap main_id https://example.org/precisao/main `consistencia`");
  });
  it("is idempotent and keeps valid Portuguese and ambiguous words", () => {
    const value = "Apoio para a bola; secretaria da turma. Adaptação à pressão. Precisão.";
    expect(text(text(value))).toBe(value);
    expect(text("PRECISAO, CONSISTENCIA" )).toBe("PRECISÃO, CONSISTÊNCIA");
  });
});
