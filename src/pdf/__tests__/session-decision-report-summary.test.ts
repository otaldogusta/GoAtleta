import { buildSessionDecisionReportPdfSummary } from "../session-decision-report-summary";
import { sessionPlanHtml } from "../templates/session-plan";

describe("session decision report PDF summary", () => {
  const visibleViewModel = {
    shouldShow: true,
    shortReason: "Esta aula considera contexto pre-jogo e sinais recentes de desempenho.",
    items: [
      "organização coletiva",
      "comunicação",
      "cobertura/transição",
      "recepção contextualizada",
    ],
    avoidItems: ["fadiga excessiva", "alta densidade", "volume desnecessário", "carga alta"],
    evidenceItems: [
      { label: "Reduzir densidade pré-jogo", confidence: "média", typeLabel: "Regra evidence-informed" },
      { label: "Scouting influencia o foco, não sequestra o ciclo", confidence: "média", typeLabel: "Heurística operacional" },
      { label: "Regra extra", confidence: "baixa", typeLabel: "Heurística operacional" },
    ],
  };

  it("returns null when the view model should not show", () => {
    expect(buildSessionDecisionReportPdfSummary({ shouldShow: false })).toBeNull();
  });

  it("builds a compact summary with short reason", () => {
    const summary = buildSessionDecisionReportPdfSummary(visibleViewModel);

    expect(summary?.title).toBe("Justificativa do planejamento");
    expect(summary?.shortReason).toBe(visibleViewModel.shortReason);
  });

  it("limits signals, avoid items and evidence", () => {
    const summary = buildSessionDecisionReportPdfSummary(visibleViewModel);

    expect(summary?.signals).toEqual(["organização coletiva", "comunicação", "cobertura/transição"]);
    expect(summary?.avoid).toEqual(["fadiga excessiva", "alta densidade", "volume desnecessário"]);
    expect(summary?.evidence).toHaveLength(2);
  });

  it("does not expose internal ids", () => {
    const summary = buildSessionDecisionReportPdfSummary({
      shouldShow: true,
      shortReason: "Ajuste por scouting recente.",
      items: ["scouting_weakness_influences_focus_not_cycle"],
      avoidItems: [],
      evidenceItems: [{ label: "Regra aplicada", confidence: "média" }],
    });

    expect(JSON.stringify(summary)).not.toContain("evidenceRuleIds");
  });

  it("does not render the section when decisionReport is absent", () => {
    const html = sessionPlanHtml({
      className: "El Cartel",
      dateLabel: "09/05/2026",
      title: "Treino",
      totalTime: "60 min",
      blocks: [],
    });

    expect(html).not.toContain("Justificativa do planejamento");
  });

  it("renders the planning rationale when decisionReport is present", () => {
    const summary = buildSessionDecisionReportPdfSummary(visibleViewModel);
    const html = sessionPlanHtml({
      className: "El Cartel",
      dateLabel: "09/05/2026",
      title: "Treino",
      totalTime: "60 min",
      decisionReport: summary,
      blocks: [],
    });

    expect(html).toContain("Justificativa do planejamento");
    expect(html).toContain("Sinais usados:");
    expect(html).toContain("Base aplicada:");
    expect(html).not.toContain("Regra extra");
  });
});
