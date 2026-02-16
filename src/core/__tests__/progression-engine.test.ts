import {
    buildNextSessionProgression,
    buildNextVolleyballLessonPlan,
} from "../progression-engine";

describe("progression-engine", () => {
  it("uses consistencia when previous quality is low", () => {
    const plan = buildNextSessionProgression({
      className: "Sub 14",
      objective: "",
      focusSkills: ["passe", "levantamento"],
      previousSnapshot: {
        consistencyScore: 0.3,
        successRate: 0.4,
        decisionQuality: 0.6,
        notes: [],
      },
    });

    expect(plan.progressionDimension).toBe("consistencia");
    expect(plan.successCriteria.length).toBeGreaterThan(0);
  });

  it("uses transferencia_jogo when metrics are high", () => {
    const plan = buildNextSessionProgression({
      className: "Sub 17",
      objective: "Consolidar transição ofensiva",
      focusSkills: ["transicao", "ataque"],
      previousSnapshot: {
        consistencyScore: 0.9,
        successRate: 0.91,
        decisionQuality: 0.92,
        notes: ["boa continuidade"],
      },
    });

    expect(plan.progressionDimension).toBe("transferencia_jogo");
    expect(plan.objective).toContain("Consolidar");
  });

  it("returns structured volleyball lesson plan with rules and citations", () => {
    const plan = buildNextVolleyballLessonPlan({
      classId: "class-1",
      unitId: "unit-1",
      className: "Sub 16",
      objective: "Consolidar leitura de saque",
      focusSkills: ["passe", "levantamento"],
      previousSnapshot: {
        consistencyScore: 0.66,
        successRate: 0.61,
        decisionQuality: 0.58,
        notes: [],
      },
      lastRpeGroup: 7,
      lastAttendanceCount: 12,
    });

    expect(plan.sport).toBe("volleyball_indoor");
    expect(plan.rulesTriggered.length).toBeGreaterThan(0);
    expect(plan.blocks.some((block) => block.type === "warmup_preventive")).toBe(true);
    expect(plan.citations.length).toBeGreaterThan(0);
  });
});
