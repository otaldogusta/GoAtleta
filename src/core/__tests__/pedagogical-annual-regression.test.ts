import { resolveNextPedagogicalStepFromPeriodization } from "../pedagogy/resolve-next-pedagogical-step-from-periodization";

describe("pedagogical annual regression guards", () => {
  it("keeps 08-10 April less advanced than September", () => {
    const april = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 4,
    });
    const september = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 9,
    });

    expect(april?.gameForm).toBe("mini_2x2");
    expect(september?.gameForm).toBe("mini_2x2");
    expect(april?.nextStep).toContain("set_target_simple");
    expect(april?.nextStep).not.toContain("coverage_intro");
    expect(september?.nextStep).toContain("coverage_intro");
  });

  it("keeps 08-10 January and February inside expected scope", () => {
    const january = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 1,
    });
    const february = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 2,
    });

    expect(january?.gameForm).toBe("mini_2x2");
    expect(january?.complexityLevel).toBe("baixo");
    expect(february?.gameForm).toBe("mini_2x2");
    expect(february?.complexityLevel).not.toBe("moderado_alto");
    expect(february?.nextStep).not.toContain("block_marking_intro");
  });

  it("keeps 08-10 December as closure instead of abrupt advancement", () => {
    const december = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 12,
    });

    const mergedText = [
      december?.currentStage ?? "",
      ...(december?.pedagogicalConstraints ?? []),
    ].join(" ").toLowerCase();

    expect(mergedText).toMatch(/revis|fech|encerr/);
    expect(december?.nextStep).not.toContain("attack_arm_intro");
    expect(december?.nextStep).not.toContain("block_marking_intro");
  });

  it("keeps 11-12 January distinct from October progression", () => {
    const january = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "11-12",
      monthIndex: 1,
    });
    const october = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "11-12",
      monthIndex: 10,
    });

    expect(january?.gameForm).toBe("mini_3x3");
    expect(october?.gameForm).toBe("mini_3x3");
    expect(january?.nextStep).toContain("mini_game_3x3_intro");
    expect(january?.nextStep).toContain("defense_control_intro");
    expect(october?.nextStep).toContain("three_action_continuity");
    expect(october?.nextStep).toContain("coverage_intro");
  });

  it("keeps 11-12 annual progression gradual across defense, coverage, attack and block", () => {
    const march = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "11-12",
      monthIndex: 3,
    });
    const april = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "11-12",
      monthIndex: 4,
    });
    const may = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "11-12",
      monthIndex: 5,
    });

    expect(march?.nextStep).toContain("coverage_intro");
    expect(april?.nextStep).toContain("attack_arm_intro");
    expect(may?.nextStep).toContain("block_marking_intro");
    expect(may?.pedagogicalConstraints.join(" ").toLowerCase()).toContain("não cobrar tempo de bloqueio adulto");
  });

  it("keeps 13-14 as mini 4x4 transition instead of early formal 6x6", () => {
    const january = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "13-14",
      monthIndex: 1,
    });
    const october = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "13-14",
      monthIndex: 10,
    });

    expect(january?.gameForm).toBe("mini_4x4");
    expect(october?.gameForm).toBe("mini_4x4");
    expect(january?.pedagogicalConstraints.join(" ").toLowerCase()).toContain("6x6");
    expect(october?.pedagogicalConstraints.join(" ").toLowerCase()).toContain("6x6");
  });

  it("holds monthly progression when recent history asks for review", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 4,
      recentConfirmedSkills: ["receive_direction", "two_action_continuity", "mini_game_2x2_continuity"],
      recentContexts: ["application_game", "reduced_court"],
      teacherOverrides: ["segurar e revisar fundamentos da turma"],
      historicalConfidence: 0.95,
    });

    expect(step?.stageId).toBe("08-10_apr_01");
    expect(step?.gameForm).toBe("mini_2x2");
  });

  it("pulls monthly progression forward when history is strong and stable", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 4,
      recentConfirmedSkills: ["receive_direction", "two_action_continuity", "mini_game_2x2_continuity"],
      recentContexts: ["application_game", "reduced_court", "continuity_game"],
      historicalConfidence: 0.95,
    });

    expect(step?.stageId).toBe("08-10_apr_03");
    expect(step?.sequenceIndex).toBe(3);
  });

  it("keeps manual override influence without breaking macro constraints", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 2,
      teacherOverrides: ["não usar alvo esta semana por ajuste do professor"],
      recentConfirmedSkills: ["underhand_serve_intro", "receive_simple"],
      recentContexts: ["pair_work", "continuity_game"],
      historicalConfidence: 0.75,
    });

    expect(step?.pedagogicalConstraints).toContain("não usar alvo esta semana por ajuste do professor");
    expect(step?.gameForm).toBe("mini_2x2");
    expect(step?.complexityLevel).not.toBe("moderado_alto");
  });
});
