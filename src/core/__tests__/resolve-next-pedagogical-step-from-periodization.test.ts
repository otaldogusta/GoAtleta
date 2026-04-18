import { resolveNextPedagogicalStepFromPeriodization } from "../pedagogy/resolve-next-pedagogical-step-from-periodization";

describe("resolve-next-pedagogical-step-from-periodization", () => {
  it("resolves February for 08-10 as continuity stage with adapted 2x2", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 2,
    });

    expect(step).not.toBeNull();
    expect(step?.currentStage).toContain("continuidade");
    expect(step?.gameForm).toBe("mini_2x2");
    expect(step?.nextStep).toContain("two_action_continuity");
    expect(step?.nextStep).toContain("mini_game_2x2_intro");
    expect(step?.blockRecommendations.warmup.length).toBeGreaterThan(0);
    expect(step?.blockRecommendations.main.length).toBeGreaterThan(0);
  });

  it("resolves March for 08-10 as 2 to 3 actions with continuity", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "08-10",
      monthIndex: 3,
    });

    expect(step?.gameForm).toBe("mini_2x2");
    expect(step?.complexityLevel).toBe("moderado");
    expect(step?.nextStep).toContain("lift_front_intro");
    expect(step?.nextStep).toContain("three_action_continuity");
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
    expect(step?.sourceTrail[0]?.methodology).toBe("instituto_compartilhar");
  });

  it("resolves 13-14 as mini 4x4 transition", () => {
    const step = resolveNextPedagogicalStepFromPeriodization({
      ageBand: "13-14",
      monthIndex: 1,
    });

    expect(step?.gameForm).toBe("mini_4x4");
    expect(step?.complexityLevel).toBe("moderado_alto");
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
});
