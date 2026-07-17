import { normalizeAIActionDate } from "../ai-context.ts";

describe("AI action context", () => {
  test("normaliza a data da ação usada pelo contexto documental", () => {
    expect(normalizeAIActionDate("2026-07-16")).toBe("2026-07-16");
    expect(normalizeAIActionDate("2026-07-16T14:00:00-03:00")).toBe(
      "2026-07-16"
    );
  });

  test("rejeita datas ambíguas ou impossíveis", () => {
    expect(normalizeAIActionDate("16/07/2026")).toBeNull();
    expect(normalizeAIActionDate("2026-02-30")).toBeNull();
    expect(normalizeAIActionDate("")).toBeNull();
  });
});
