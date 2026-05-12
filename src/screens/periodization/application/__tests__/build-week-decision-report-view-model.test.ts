import { buildWeekDecisionReportViewModel } from "../build-week-decision-report-view-model";

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
          "Scouting deve influenciar focos sem sequestrar o ciclo.",
          "Carga deve ser tratada como sinal.",
        ],
        confidence: ["medium", "medium"],
      },
      ...overrides,
    },
  });

const baseInput = {
  classId: "class_1",
  weekStartDate: "2026-05-11",
};

describe("buildWeekDecisionReportViewModel", () => {
  test("returns hidden view model without relevant signals", () => {
    const viewModel = buildWeekDecisionReportViewModel(baseInput);

    expect(viewModel.shouldShow).toBe(false);
    expect(viewModel.sections).toEqual([]);
  });

  test("shows report with scouting snapshot", () => {
    const viewModel = buildWeekDecisionReportViewModel({
      ...baseInput,
      weekPlan: {
        technicalFocus: "Saque e recepção",
        specificObjective: "Continuidade",
        constraints: "Carga moderada",
        generationContextSnapshotJson: makeSnapshot(),
      },
    });

    expect(viewModel.shouldShow).toBe(true);
    expect(viewModel.shortReason).toContain("scouting recente");
    expect(viewModel.sections.find((section) => section.title === "Sinais usados")?.items).toContain(
      "recepção sob pressão",
    );
  });

  test("formats evidence items without exposing rule ids", () => {
    const viewModel = buildWeekDecisionReportViewModel({
      ...baseInput,
      weekPlan: {
        generationContextSnapshotJson: makeSnapshot(),
      },
    });

    expect(viewModel.evidenceItems).toHaveLength(2);
    expect(viewModel.evidenceItems[0]?.label).toBe("Scouting influencia foco, nao sequestra ciclo");
    expect(viewModel.evidenceItems[0]?.confidence).toBe("media");
    expect(JSON.stringify(viewModel)).not.toContain("scouting_weakness_influences_focus_not_cycle");
  });

  test("marks manual override as preserved", () => {
    const viewModel = buildWeekDecisionReportViewModel({
      ...baseInput,
      manualOverride: true,
      weekPlan: {
        source: "MANUAL",
        technicalFocus: "Foco manual",
        generationContextSnapshotJson: makeSnapshot({ manualPreserved: true }),
      },
    });

    expect(viewModel.shouldShow).toBe(true);
    expect(viewModel.manualOverridePreserved).toBe(true);
    expect(viewModel.shortReason).toContain("Plano manual preservado");
  });

  test("limits list sizes", () => {
    const viewModel = buildWeekDecisionReportViewModel({
      ...baseInput,
      weekPlan: {
        generationContextSnapshotJson: makeSnapshot({
          weaknesses: ["w1", "w2", "w3", "w4", "w5", "w6"],
          recommendedFocus: ["f1", "f2", "f3", "f4", "f5"],
        }),
      },
    });

    expect(viewModel.sections.find((section) => section.title === "Sinais usados")?.items.length).toBeLessThanOrEqual(4);
    expect(viewModel.sections.find((section) => section.title === "Focos aplicados")?.items.length).toBeLessThanOrEqual(4);
  });

  test("invalid snapshot does not break", () => {
    const viewModel = buildWeekDecisionReportViewModel({
      ...baseInput,
      weekPlan: {
        generationContextSnapshotJson: "{invalid",
      },
    });

    expect(viewModel.shouldShow).toBe(false);
  });

  test("old snapshot without scouting impact stays hidden", () => {
    const viewModel = buildWeekDecisionReportViewModel({
      ...baseInput,
      weekPlan: {
        generationContextSnapshotJson: JSON.stringify({ weeklyStrategy: true }),
      },
    });

    expect(viewModel.shouldShow).toBe(false);
  });
});
