import { toPdfCoachingText, toPdfText } from "../pdf-coaching-text";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toContain: (expected: unknown) => void;
  not: {
    toContain: (expected: unknown) => void;
  };
  toBe: (expected: unknown) => void;
};

describe("pdf-coaching-text", () => {
  it("keeps metadata text untouched while normalizing display text", () => {
    expect(toPdfText("Turma Sub-14")).toBe("Turma Sub-14");
  });

  it("normalizes coaching vocabulary for exported content", () => {
    const value = toPdfCoachingText(
      "Ajustar a plataforma para melhorar a distribuição da bola e a continuidade ofensiva."
    );

    expect(value).toContain("manchete");
    expect(value).toContain("levantamento");
    expect(value).toContain("dar sequência na jogada");
    expect(value).not.toContain("plataforma");
    expect(value).not.toContain("distribuição da bola");
    expect(value).not.toContain("continuidade ofensiva");
  });
});
