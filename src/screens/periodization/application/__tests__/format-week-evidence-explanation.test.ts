import {
  formatWeekEvidenceExplanation,
  getEvidenceConfidenceTone,
  parseScoutingImpactEvidenceFromSnapshot,
} from "../format-week-evidence-explanation";

const makeSnapshot = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    scoutingImpact: {
      impactIds: ["impact_1"],
      recommendedFocus: ["recepção contextualizada", "cobertura pós-ataque"],
      weaknesses: ["recepção sob pressão"],
      tacticalNotes: ["Recepção apresentou recorrência de ações C/erro."],
      loadImpact: "reduce",
      appliedSignals: ["recepção contextualizada", "cobertura/transição"],
      evidenceTrace: {
        evidenceRuleIds: [
          "scouting_weakness_influences_focus_not_cycle",
          "load_monitoring_signal_not_oracle",
        ],
        evidenceSummary: [
          "Fraquezas de scouting devem influenciar focos e tarefas da semana.",
          "Indicadores de carga devem ser tratados como sinais de decisão.",
        ],
        confidence: ["medium", "medium"],
      },
      ...overrides,
    },
  });

describe("formatWeekEvidenceExplanation", () => {
  it("returns null without snapshot", () => {
    expect(formatWeekEvidenceExplanation()).toBeNull();
    expect(formatWeekEvidenceExplanation("")).toBeNull();
  });

  it("returns null without scouting impact", () => {
    expect(formatWeekEvidenceExplanation(JSON.stringify({ other: true }))).toBeNull();
  });

  it("returns null with invalid snapshot json", () => {
    expect(formatWeekEvidenceExplanation("{not-json")).toBeNull();
  });

  it("parses scouting evidence trace from snapshot", () => {
    const parsed = parseScoutingImpactEvidenceFromSnapshot(makeSnapshot());

    expect(parsed?.impactIds).toEqual(["impact_1"]);
    expect(parsed?.evidenceTrace?.evidenceRuleIds).toContain(
      "scouting_weakness_influences_focus_not_cycle",
    );
  });

  it("formats a valid evidence trace for UI", () => {
    const explanation = formatWeekEvidenceExplanation(makeSnapshot());

    expect(explanation?.title).toBe("Por que esta semana mudou?");
    expect(explanation?.signals).toContain("recepção contextualizada");
    expect(explanation?.focus).toContain("cobertura pós-ataque");
    expect(explanation?.loadAdjustment).toContain("Evitar alta densidade");
    expect(explanation?.rules.map((rule) => rule.id)).toContain(
      "scouting_weakness_influences_focus_not_cycle",
    );
  });

  it("resolves evidence rule labels", () => {
    const explanation = formatWeekEvidenceExplanation(makeSnapshot());

    expect(explanation?.rules[0]?.label).toBe("Scouting influencia foco, nao sequestra ciclo");
    expect(explanation?.rules[0]?.typeLabel).toBe("heuristica operacional");
  });

  it("ignores invalid rule ids without breaking", () => {
    const explanation = formatWeekEvidenceExplanation(
      makeSnapshot({
        evidenceTrace: {
          evidenceRuleIds: ["invalid_rule", "load_monitoring_signal_not_oracle"],
          evidenceSummary: [],
          confidence: ["medium"],
        },
      }),
    );

    expect(explanation?.rules).toHaveLength(1);
    expect(explanation?.rules[0]?.id).toBe("load_monitoring_signal_not_oracle");
  });

  it("formats confidence tone", () => {
    expect(getEvidenceConfidenceTone("low")).toBe("warning");
    expect(getEvidenceConfidenceTone("medium")).toBe("muted");
    expect(getEvidenceConfidenceTone("high")).toBe("success");
  });

  it("includes maintain load adjustment when present", () => {
    const explanation = formatWeekEvidenceExplanation(makeSnapshot({ loadImpact: "maintain" }));

    expect(explanation?.loadAdjustment).toContain("Carga planejada mantida");
  });
});
