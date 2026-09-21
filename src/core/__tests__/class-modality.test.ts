import {
  CLASS_MODALITY_OPTIONS,
  getClassModalityLabel,
  isVolleyballClassModality,
  resolveClassModality,
} from "../class-modality";

describe("class modality", () => {
  it("offers separate indoor and beach volleyball choices", () => {
    expect(CLASS_MODALITY_OPTIONS.slice(0, 2)).toEqual([
      { value: "voleibol", label: "Vôlei de quadra" },
      { value: "voleibol_areia", label: "Vôlei de areia" },
    ]);
  });

  it("preserves legacy indoor volleyball and resolves beach volleyball", () => {
    expect(getClassModalityLabel("voleibol")).toBe("Vôlei de quadra");
    expect(resolveClassModality("Vôlei de areia")).toBe("voleibol_areia");
    expect(resolveClassModality("beach volleyball")).toBe("voleibol_areia");
  });

  it("recognizes both variants as volleyball", () => {
    expect(isVolleyballClassModality("voleibol")).toBe(true);
    expect(isVolleyballClassModality("voleibol_areia")).toBe(true);
    expect(isVolleyballClassModality("futsal")).toBe(false);
  });
});
