import {
    FORBIDDEN_UI_TERMS,
    FOREIGN_SOURCE_ALIASES,
    getAgeBandLanguageStyle,
    getDisplayLabelForGameForm,
    getDisplayLabelForSkill,
    sanitizeVolleyballLanguage,
    SKILL_DISPLAY_LABELS,
} from "../pedagogy/volleyball-language-lexicon";

describe("volleyball-language-lexicon", () => {
  it("maps all canonical skill keys to Portuguese display labels", () => {
    const keys = Object.keys(SKILL_DISPLAY_LABELS);
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) {
      const label = SKILL_DISPLAY_LABELS[key as keyof typeof SKILL_DISPLAY_LABELS];
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
      // No foreign terms should leak into labels
      for (const forbidden of FORBIDDEN_UI_TERMS) {
        expect(label.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    }
  });

  it("returns correct display label for specific skills", () => {
    expect(getDisplayLabelForSkill("set_self_control")).toBe("toque para cima");
    expect(getDisplayLabelForSkill("receive_simple")).toBe("recepção simples");
    expect(getDisplayLabelForSkill("two_action_continuity")).toBe("continuidade com 2 ações");
    expect(getDisplayLabelForSkill("mini_game_2x2_intro")).toBe("mini jogo 2x2 adaptado");
    expect(getDisplayLabelForSkill("underhand_serve_intro")).toBe("saque por baixo adaptado");
  });

  it("returns correct display label for game forms", () => {
    expect(getDisplayLabelForGameForm("mini_2x2")).toBe("Mini 2x2");
    expect(getDisplayLabelForGameForm("mini_3x3")).toBe("Mini 3x3");
    expect(getDisplayLabelForGameForm("formal_6x6")).toBe("Vôlei 6x6");
  });

  it("foreign aliases map to canonical keys", () => {
    expect(FOREIGN_SOURCE_ALIASES["toetsen level 1"]).toBe("set_self_control");
    expect(FOREIGN_SOURCE_ALIASES["toetsen level 4"]).toBe("set_continuity");
    expect(FOREIGN_SOURCE_ALIASES["cmv niveau 2"]).toBe("mini_game_2x2_intro");
  });

  it("sanitizes forbidden terms from a text", () => {
    const dirty = "Os alunos fazem toetsen e chegam ao cmv niveau 1 facilmente.";
    const clean = sanitizeVolleyballLanguage(dirty);
    expect(clean).not.toContain("toetsen");
    expect(clean).not.toContain("cmv niveau");
    expect(clean).toContain("Os alunos fazem");
  });

  it("returns strict language style for 08-10", () => {
    const style = getAgeBandLanguageStyle("08-10");
    expect(style.avoidAbstraction).toBe(true);
    expect(style.preferGameLanguage).toBe(true);
    expect(style.maxSentencesPerBlock).toBe(2);
  });

  it("returns relaxed language style for 11-12", () => {
    const style = getAgeBandLanguageStyle("11-12");
    expect(style.avoidAbstraction).toBe(false);
    expect(style.maxSentencesPerBlock).toBe(3);
  });
});
