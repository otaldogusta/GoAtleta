import { PEDAGOGICAL_QUARTER_MONTH_INDEX } from "../pedagogy/pedagogical-quarterly-matrix";
import { resolveNextPedagogicalStepFromPeriodization } from "../pedagogy/resolve-next-pedagogical-step-from-periodization";

type QuarterKey = keyof typeof PEDAGOGICAL_QUARTER_MONTH_INDEX;

const buildQuarterlySnapshot = (ageBand: "08-10" | "11-12" | "13-14") => {
  const q1 = resolveNextPedagogicalStepFromPeriodization({ ageBand, monthIndex: PEDAGOGICAL_QUARTER_MONTH_INDEX.Q1 });
  const q2 = resolveNextPedagogicalStepFromPeriodization({ ageBand, monthIndex: PEDAGOGICAL_QUARTER_MONTH_INDEX.Q2 });
  const q3 = resolveNextPedagogicalStepFromPeriodization({ ageBand, monthIndex: PEDAGOGICAL_QUARTER_MONTH_INDEX.Q3 });
  const q4 = resolveNextPedagogicalStepFromPeriodization({ ageBand, monthIndex: PEDAGOGICAL_QUARTER_MONTH_INDEX.Q4 });

  return { q1, q2, q3, q4 };
};

describe("pedagogical quarterly snapshots", () => {
  it("keeps 08-10 quarterly progression coherent from exploration to closure", () => {
    const { q1, q2, q3, q4 } = buildQuarterlySnapshot("08-10");

    expect(q1?.gameForm).toBe("mini_2x2");
    expect(q1?.complexityLevel).toBe("baixo");
    expect(q1?.nextStep).toContain("set_self_control");

    expect(q2?.gameForm).toBe("mini_2x2");
    expect(q2?.nextStep).toContain("set_continuity");
    expect(q2?.nextStep).toContain("two_action_continuity");

    expect(q3?.gameForm).toBe("mini_2x2");
    expect(q3?.nextStep).toContain("coverage_intro");

    const q4Text = [q4?.currentStage ?? "", ...(q4?.pedagogicalConstraints ?? [])].join(" ").toLowerCase();
    expect(q4?.gameForm).toBe("mini_2x2");
    expect(q4Text).toMatch(/revis|fech|encerr/);
  });

  it("keeps 11-12 quarterly progression coherent from 3x3 entry to consolidation", () => {
    const { q1, q2, q3, q4 } = buildQuarterlySnapshot("11-12");

    expect(q1?.gameForm).toBe("mini_3x3");
    expect(q1?.nextStep).toContain("mini_game_3x3_intro");
    expect(q1?.nextStep).toContain("defense_control_intro");

    expect(q2?.gameForm).toBe("mini_3x3");
    expect(q2?.nextStep).toContain("block_marking_intro");
    expect(q2?.nextStep).toContain("coverage_intro");

    expect(q3?.gameForm).toBe("mini_3x3");
    expect(q3?.nextStep).toContain("mini_game_3x3_intro");
    expect(q3?.nextStep).toContain("block_marking_intro");

    const q4Text = [q4?.currentStage ?? "", ...(q4?.pedagogicalConstraints ?? [])].join(" ").toLowerCase();
    expect(q4?.gameForm).toBe("mini_3x3");
    expect(q4Text).toMatch(/fech|integr|consolid/);
  });

  it("keeps 13-14 quarterly progression as functional 4x4 transition", () => {
    const { q1, q2, q3, q4 } = buildQuarterlySnapshot("13-14");

    expect(q1?.gameForm).toBe("mini_4x4");
    expect(q1?.pedagogicalConstraints.join(" ").toLowerCase()).toContain("6x6");

    expect(q2?.gameForm).toBe("mini_4x4");
    expect(q2?.nextStep).toContain("three_action_continuity");

    expect(q3?.gameForm).toBe("mini_4x4");
    expect(q3?.nextStep).toContain("three_action_continuity");
    expect(q3?.nextStep).toContain("defense_control_intro");

    const q4Text = [q4?.currentStage ?? "", ...(q4?.pedagogicalConstraints ?? [])].join(" ").toLowerCase();
    expect(q4?.gameForm).toBe("mini_4x4");
    expect(q4?.complexityLevel).toBe("moderado_alto");
    expect(q4Text).toMatch(/ponte|formaliza|fech/);
  });

  it("prevents quarter-to-quarter drift to adult formal game", () => {
    const bands: Array<"08-10" | "11-12" | "13-14"> = ["08-10", "11-12", "13-14"];

    for (const ageBand of bands) {
      for (const monthIndex of [PEDAGOGICAL_QUARTER_MONTH_INDEX.Q1, PEDAGOGICAL_QUARTER_MONTH_INDEX.Q2, PEDAGOGICAL_QUARTER_MONTH_INDEX.Q3, PEDAGOGICAL_QUARTER_MONTH_INDEX.Q4]) {
        const step = resolveNextPedagogicalStepFromPeriodization({ ageBand, monthIndex });
        expect(step?.gameForm).not.toBe("formal_6x6");
      }
    }
  });
});
