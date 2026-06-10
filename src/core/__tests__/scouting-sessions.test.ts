import type { ScoutingAction } from "../models";
import {
  aggregateScoutingActionsToCounts,
  buildScoutingAthleteHighlights,
  buildScoutingTeamSignals,
  buildScoutingWeeklyPriorities,
  getScoutingResultOptions,
  legacyCountsToScoutingPlanningSignal,
  toScoutingPlanningSignal,
} from "../scouting";

const action = (
  id: string,
  overrides: Partial<ScoutingAction>
): ScoutingAction => ({
  id,
  sessionId: "ss_1",
  organizationId: "org_1",
  classId: "class_1",
  studentId: null,
  athleteName: null,
  fundamental: "saque",
  phase: "side_out",
  resultKey: "erro",
  resultLabel: "Erro",
  resultLevel: 0,
  createdAt: `2026-06-03T10:00:0${id}.000Z`,
  ...overrides,
});

describe("scouting session helpers", () => {
  test("aggregates actions into legacy scouting counts", () => {
    const counts = aggregateScoutingActionsToCounts([
      action("1", { fundamental: "saque", resultLevel: 0 }),
      action("2", { fundamental: "saque", resultLevel: 1 }),
      action("3", { fundamental: "saque", resultLevel: 2 }),
      action("4", { fundamental: "saque", resultLevel: 3 }),
      action("5", { fundamental: "recepcao", resultLevel: 3 }),
      action("6", { fundamental: "defesa", resultLevel: 3 }),
    ]);

    expect(counts.serve).toEqual({ 0: 1, 1: 2, 2: 1 });
    expect(counts.receive).toEqual({ 0: 0, 1: 0, 2: 1 });
    expect(counts.set).toEqual({ 0: 0, 1: 0, 2: 0 });
    expect(counts.attack_send).toEqual({ 0: 0, 1: 0, 2: 0 });
  });

  test("returns contextual result options for fundamentals", () => {
    expect(getScoutingResultOptions("recepcao").map((option) => option.label)).toEqual([
      "Erro",
      "C/Baixo",
      "B/Médio",
      "A/Alto",
    ]);
    expect(getScoutingResultOptions("ataque").map((option) => option.label)).toEqual([
      "Erro",
      "Bloqueado",
      "Continuidade",
      "Ponto",
    ]);
  });

  test("keeps signals and priorities empty with insufficient sample", () => {
    const actions = [
      action("1", { fundamental: "recepcao", resultLevel: 0 }),
      action("2", { fundamental: "recepcao", resultLevel: 0 }),
    ];

    expect(buildScoutingTeamSignals(actions)).toEqual([]);
    expect(buildScoutingWeeklyPriorities(actions)).toEqual([]);
    expect(buildScoutingAthleteHighlights(actions)).toEqual([]);
  });

  test("removing the last action preserves recalculated counts", () => {
    const actions = [
      action("1", { fundamental: "ataque", resultLevel: 3 }),
      action("2", { fundamental: "ataque", resultLevel: 0 }),
      action("3", { fundamental: "ataque", resultLevel: 2 }),
    ];

    expect(aggregateScoutingActionsToCounts(actions).attack_send).toEqual({
      0: 1,
      1: 1,
      2: 1,
    });
    expect(aggregateScoutingActionsToCounts(actions.slice(1)).attack_send).toEqual({
      0: 1,
      1: 1,
      2: 0,
    });
  });

  test("builds a planning signal from rich scouting actions", () => {
    const actions = [
      action("1", { fundamental: "defesa", phase: "transicao", resultLevel: 0 }),
      action("2", { fundamental: "defesa", phase: "transicao", resultLevel: 1 }),
      action("3", { fundamental: "defesa", phase: "freeball", resultLevel: 1 }),
      action("4", { fundamental: "recepcao", phase: "side_out", resultLevel: 3 }),
      action("5", { fundamental: "recepcao", phase: "side_out", resultLevel: 2 }),
      action("6", { fundamental: "ataque", phase: "transicao", resultLevel: 2 }),
      action("7", { fundamental: "ataque", phase: "transicao", resultLevel: 2 }),
      action("8", { fundamental: "comunicacao", phase: "side_out", resultLevel: 3 }),
    ];

    expect(toScoutingPlanningSignal(actions)).toMatchObject({
      dominantWeakSkill: "defesa",
      dominantWeakFundamental: "defesa",
      dominantWeakPhase: "transicao",
      dominantGapType: "tomada_decisao",
      difficulty: "high",
      sampleSize: 8,
      confidence: "medium",
    });
  });

  test("builds a compatible planning signal from legacy counts", () => {
    expect(
      legacyCountsToScoutingPlanningSignal({
        serve: { 0: 0, 1: 4, 2: 8 },
        receive: { 0: 5, 1: 3, 2: 0 },
        set: { 0: 0, 1: 5, 2: 6 },
        attack_send: { 0: 1, 1: 3, 2: 7 },
      })
    ).toMatchObject({
      dominantWeakSkill: "passe",
      dominantGapType: "tecnica",
      difficulty: "high",
      sampleSize: 42,
      confidence: "high",
    });
  });

  test("preserves rich coverage, transition and communication gaps for planning", () => {
    expect(
      toScoutingPlanningSignal([
        action("1", { fundamental: "cobertura", phase: "transicao", resultLevel: 0 }),
        action("2", { fundamental: "cobertura", phase: "transicao", resultLevel: 1 }),
        action("3", { fundamental: "cobertura", phase: "transicao", resultLevel: 1 }),
        action("4", { fundamental: "transicao", phase: "transicao", resultLevel: 2 }),
        action("5", { fundamental: "transicao", phase: "transicao", resultLevel: 2 }),
        action("6", { fundamental: "comunicacao", phase: "side_out", resultLevel: 2 }),
        action("7", { fundamental: "comunicacao", phase: "side_out", resultLevel: 2 }),
        action("8", { fundamental: "recepcao", phase: "side_out", resultLevel: 3 }),
      ])
    ).toMatchObject({
      dominantWeakSkill: "defesa",
      dominantWeakFundamental: "cobertura",
      dominantWeakPhase: "transicao",
      dominantGapType: "organizacao",
      sampleSize: 8,
      confidence: "medium",
    });

    expect(
      toScoutingPlanningSignal([
        action("1", { fundamental: "comunicacao", phase: "side_out", resultLevel: 0 }),
        action("2", { fundamental: "comunicacao", phase: "side_out", resultLevel: 1 }),
        action("3", { fundamental: "comunicacao", phase: "side_out", resultLevel: 1 }),
        action("4", { fundamental: "recepcao", phase: "side_out", resultLevel: 3 }),
        action("5", { fundamental: "recepcao", phase: "side_out", resultLevel: 3 }),
        action("6", { fundamental: "saque", phase: "saque", resultLevel: 2 }),
        action("7", { fundamental: "saque", phase: "saque", resultLevel: 2 }),
        action("8", { fundamental: "ataque", phase: "transicao", resultLevel: 3 }),
      ])
    ).toMatchObject({
      dominantWeakSkill: "passe",
      dominantWeakFundamental: "comunicacao",
      dominantGapType: "organizacao",
      sampleSize: 8,
      confidence: "medium",
    });
  });
});
