import { resolveNextPedagogicalStepFromPeriodization } from "../pedagogy/resolve-next-pedagogical-step-from-periodization";

describe("resolve-next-pedagogical-step-from-periodization", () => {
  it("resolves February for 08-10 as adapted serve and simple target stage", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 2,
    });

    expect(step).not.toBeNull();
    expect(step?.currentStage).toContain("saque por baixo adaptado");
    expect(step?.gameForm).toBe("mini_2x2");
    expect(step?.nextStep).toContain("underhand_serve_target");
    expect(step?.nextStep).toContain("receive_simple");
    expect(step?.blockRecommendations.warmup.skills.length).toBeGreaterThan(0);
    expect(step?.blockRecommendations.main.skills.length).toBeGreaterThan(0);
  });

  it("resolves March for 08-10 as reception, set and return bridge stage", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 3,
    });

    expect(step?.gameForm).toBe("mini_2x2");
    expect(step?.complexityLevel).toBe("moderado");
    expect(step?.nextStep).toContain("lift_front_intro");
    expect(step?.nextStep).toContain("two_action_continuity");
    expect(step?.sourceTrail[0]?.methodology).toBe("rede_esperanca");
  });

  it("resolves January for 08-10 as initial exploration", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 1,
    });

    expect(step?.complexityLevel).toBe("baixo");
    expect(step?.nextStep).toContain("set_self_control");
  });

  it("resolves 11-12 as mini 3x3 stage", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "11-12",
      monthIndex: 1,
    });

    expect(step?.gameForm).toBe("mini_3x3");
    expect(step?.nextStep).toContain("mini_game_3x3_intro");
    expect(step?.nextStep).toContain("defense_control_intro");
    expect(step?.sourceTrail[0]?.methodology).toBe("instituto_compartilhar");
  });

  it("progresses 11-12 in May with block and coverage without adult formalism", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "11-12",
      monthIndex: 5,
    });

    expect(step?.gameForm).toBe("mini_3x3");
    expect(step?.currentStage).toContain("bloqueio inicial");
    expect(step?.nextStep).toContain("block_marking_intro");
    expect(step?.pedagogicalConstraints.join(" ")).not.toContain("6x6");
  });

  it("keeps 11-12 in mini 3x3 during September application phase", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "11-12",
      monthIndex: 9,
    });

    expect(step?.gameForm).toBe("mini_3x3");
    expect(step?.nextStep).toContain("block_marking_intro");
    expect(step?.alreadyPracticedContexts).toContain("application_game");
  });

  it("resolves 13-14 as mini 4x4 transition", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "13-14",
      monthIndex: 1,
    });

    expect(step?.gameForm).toBe("mini_4x4");
    expect(step?.complexityLevel).toBe("moderado_alto");
    expect(step?.nextStep).toContain("attack_arm_intro");
  });

  it("progresses 13-14 in April with block and attack inside mini 4x4", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "13-14",
      monthIndex: 4,
    });

    expect(step?.gameForm).toBe("mini_4x4");
    expect(step?.currentStage).toContain("bloqueio inicial");
    expect(step?.nextStep).toContain("block_marking_intro");
    expect(step?.nextStep).toContain("attack_arm_intro");
  });

  it("keeps 13-14 as transition game in October without jumping to formal volleyball", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "13-14",
      monthIndex: 10,
    });

    expect(step?.gameForm).toBe("mini_4x4");
    expect(step?.complexityLevel).toBe("moderado_alto");
    expect(step?.nextStep).toContain("block_marking_intro");
    expect(step?.pedagogicalConstraints.join(" ")).not.toContain("6x6 completo");
  });

  it("returns null for unknown ageBand", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "18-99" as never,
      monthIndex: 3,
    });

    expect(step).toBeNull();
  });

  it("respects teacher overrides in constraints", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 2,
      teacherOverrides: ["não usar alvo esta semana"],
    });

    expect(step?.pedagogicalConstraints).toContain("não usar alvo esta semana");
  });

  it("advances to a later stage in April when recent skills support it", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 4,
      recentConfirmedSkills: ["receive_direction", "two_action_continuity", "mini_game_2x2_continuity"],
      recentContexts: ["application_game", "reduced_court"],
      historicalConfidence: 0.9,
    });

    expect(step?.stageId).toBe("08-10_apr_03");
    expect(step?.sequenceIndex).toBe(3);
  });

  it("holds the progression in May when teacher asks to review", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 5,
      recentConfirmedSkills: ["set_continuity", "two_action_continuity"],
      teacherOverrides: ["segurar e revisar fundamentos nesta semana"],
      historicalConfidence: 0.9,
    });

    expect(step?.stageId).toBe("08-10_may_01");
  });

  it("offers June stage without jumping to adult complexity", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 6,
    });

    expect(step?.gameForm).toBe("mini_2x2");
    expect(step?.complexityLevel).not.toBe("moderado_alto");
    expect(step?.currentStage).toContain("jogo reduzido");
  });
});
