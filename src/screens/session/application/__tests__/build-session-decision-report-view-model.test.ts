import type { TeamPlanningContext } from "../../../../core/team-context";
import { buildSessionDecisionReportViewModel } from "../build-session-decision-report-view-model";

const baseInput = {
  classId: "class_1",
  sessionDate: "2026-05-11",
};

const preMatchContext: TeamPlanningContext = {
  hasUpcomingMatch: true,
  daysUntilMatch: 1,
  planningMode: "pre_match",
  recommendedLoadBias: "reduce",
  focusHints: ["organização coletiva", "comunicação", "ajuste tático"],
  avoidHints: ["fadiga excessiva", "alta densidade"],
  reason: "partida em 1 dia",
};

const makeSnapshot = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    scoutingImpact: {
      impactIds: ["impact_1"],
      recommendedFocus: ["recepção contextualizada"],
      weaknesses: ["recepção sob pressão"],
      tacticalNotes: ["Recepção apresentou recorrência de ações C/erro."],
      loadImpact: "maintain",
      evidenceTrace: {
        evidenceRuleIds: ["scouting_weakness_influences_focus_not_cycle"],
        evidenceSummary: ["Scouting deve influenciar foco sem sequestrar o ciclo."],
        confidence: ["medium"],
      },
      ...overrides,
    },
  });

describe("buildSessionDecisionReportViewModel", () => {
  test("returns hidden model without signals", () => {
    const viewModel = buildSessionDecisionReportViewModel(baseInput);

    expect(viewModel.shouldShow).toBe(false);
    expect(viewModel.items).toEqual([]);
  });

  test("pre-match context returns visible model", () => {
    const viewModel = buildSessionDecisionReportViewModel({
      ...baseInput,
      teamPlanningContext: preMatchContext,
    });

    expect(viewModel.shouldShow).toBe(true);
    expect(viewModel.shortReason).toContain("pré-jogo");
    expect(viewModel.items).toEqual(expect.arrayContaining(["partida em 1 dia", "organização coletiva"]));
    expect(viewModel.avoidItems).toEqual(expect.arrayContaining(["fadiga excessiva"]));
  });

  test("scouting evidence creates evidence items", () => {
    const viewModel = buildSessionDecisionReportViewModel({
      ...baseInput,
      dailyPlan: {
        generationContextSnapshotJson: makeSnapshot(),
      },
    });

    expect(viewModel.shouldShow).toBe(true);
    expect(viewModel.items).toContain("recepção sob pressão");
    expect(viewModel.evidenceItems[0]?.label).toBe("Scouting influencia foco, nao sequestra ciclo");
    expect(JSON.stringify(viewModel)).not.toContain("scouting_weakness_influences_focus_not_cycle");
  });

  test("manual override shows preservation message", () => {
    const viewModel = buildSessionDecisionReportViewModel({
      ...baseInput,
      manualOverride: true,
      dailyPlan: {
        syncStatus: "overridden",
        title: "Aula manual",
        generationContextSnapshotJson: makeSnapshot({ manualPreserved: true }),
      },
    });

    expect(viewModel.shouldShow).toBe(true);
    expect(viewModel.manualOverridePreserved).toBe(true);
    expect(viewModel.shortReason).toContain("Plano manual preservado");
  });

  test("limits items", () => {
    const viewModel = buildSessionDecisionReportViewModel({
      ...baseInput,
      teamPlanningContext: {
        ...preMatchContext,
        focusHints: ["f1", "f2", "f3", "f4", "f5", "f6"],
        avoidHints: ["a1", "a2", "a3", "a4"],
      },
    });

    expect(viewModel.items.length).toBeLessThanOrEqual(4);
    expect(viewModel.avoidItems.length).toBeLessThanOrEqual(3);
  });

  test("old incomplete snapshot does not break", () => {
    const viewModel = buildSessionDecisionReportViewModel({
      ...baseInput,
      dailyPlan: {
        generationContextSnapshotJson: JSON.stringify({ source: "training_plan_apply" }),
      },
    });

    expect(viewModel.shouldShow).toBe(false);
  });

  test("invalid snapshot does not break", () => {
    const viewModel = buildSessionDecisionReportViewModel({
      ...baseInput,
      dailyPlan: {
        generationContextSnapshotJson: "{invalid",
      },
    });

    expect(viewModel.shouldShow).toBe(false);
  });
});
