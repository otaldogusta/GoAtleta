import { buildPedagogicalQuarterlyMatrix } from "../pedagogy/pedagogical-quarterly-matrix";

describe("pedagogical quarterly matrix", () => {
  it("builds a readable 08-10 matrix with four quarters and no adult drift risks", () => {
    const matrix = buildPedagogicalQuarterlyMatrix("08-10");

    expect(matrix).toHaveLength(4);
    expect(matrix[0]?.quarter).toBe("Q1");
    expect(matrix[0]?.gameFormLabel).toBe("Mini 2x2");
    expect(matrix[0]?.closingType).toBe("exploracao");
    expect(matrix[2]?.focusSkills.join(" ").toLowerCase()).toContain("cobertura");
    expect(matrix.flatMap((item) => item.driftRisks)).not.toContain("salto_para_formal_6x6");
  });

  it("builds a readable 11-12 matrix showing progression from entry to consolidation", () => {
    const matrix = buildPedagogicalQuarterlyMatrix("11-12");

    expect(matrix).toHaveLength(4);
    expect(matrix[0]?.gameFormLabel).toBe("Mini 3x3");
    expect(matrix[1]?.focusSkills.join(" ").toLowerCase()).toContain("bloqueio");
    expect(matrix[3]?.closingType).toBe("fechamento");
  });

  it("builds a readable 13-14 matrix preserving the 4x4 bridge in all quarters", () => {
    const matrix = buildPedagogicalQuarterlyMatrix("13-14");

    expect(matrix).toHaveLength(4);
    expect(matrix.every((item) => item.gameForm === "mini_4x4")).toBe(true);
    expect(matrix.every((item) => item.gameFormLabel === "Mini 4x4")).toBe(true);
    expect(matrix.flatMap((item) => item.driftRisks)).not.toContain("salto_para_formal_6x6");
    expect(matrix.flatMap((item) => item.driftRisks)).not.toContain("perda_da_ponte_funcional_13_14");
  });
});
