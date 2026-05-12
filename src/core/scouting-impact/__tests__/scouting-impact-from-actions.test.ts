import { createScoutingAction } from "../../scouting-action";
import { assertEvidenceRuleIds } from "../../evidence";
import {
  generateScoutingImpactFromActions,
  resolveLoadImpactFromSessionAndActions,
} from "../scouting-impact-from-actions";
import { calculateScoutingPriorityBySkill } from "../scouting-impact-priority";

const makeAction = (overrides: Partial<ReturnType<typeof createScoutingAction>> = {}) => ({
  ...createScoutingAction({
    scoutingSessionId: "session_1",
    classId: "class_1",
    athleteName: "Maria",
    skill: "receive",
    actionType: "pass_c",
    quality: "low",
    score: 1,
  }),
  ...overrides,
});

describe("scouting-impact-from-actions", () => {
  test("does not generate impact with few actions", () => {
    const result = generateScoutingImpactFromActions({
      classId: "class_1",
      scoutingSessionId: "session_1",
      date: "2026-05-09",
      actions: [makeAction(), makeAction()],
    });
    expect(result.impact).toBeNull();
    expect(result.confidence).toBe("low");
    expect(result.ignoredReasons).toContain("dados insuficientes");
    expect(result.evidenceTrace?.evidenceRuleIds).toContain("small_sample_no_strong_scouting_impact");
  });

  test("generates weakness for recurring low receive score", () => {
    const result = generateScoutingImpactFromActions({
      classId: "class_1",
      scoutingSessionId: "session_1",
      date: "2026-05-09",
      actions: [
        makeAction({ skill: "receive", score: 0, actionType: "error" }),
        makeAction({ skill: "receive", score: 1, actionType: "pass_c" }),
        makeAction({ skill: "receive", score: 1, actionType: "pass_c" }),
        makeAction({ skill: "serve", score: 2, actionType: "difficult" }),
        makeAction({ skill: "serve", score: 2, actionType: "difficult" }),
        makeAction({ skill: "serve", score: 2, actionType: "difficult" }),
      ],
    });
    expect(result.impact?.weaknesses).toContain("recepção sob pressão");
    expect(result.impact?.recommendedFocus).toContain("recepção sob pressão");
    expect(result.impact?.tacticalNotes.join(" ")).toContain("Recepção apresentou");
    expect(result.impact?.evidenceTrace?.evidenceRuleIds).toContain("scouting_weakness_influences_focus_not_cycle");
  });

  test("generates strength for recurring high serve score", () => {
    const result = generateScoutingImpactFromActions({
      classId: "class_1",
      scoutingSessionId: "session_1",
      date: "2026-05-09",
      actions: [
        makeAction({ skill: "serve", score: 3, actionType: "ace" }),
        makeAction({ skill: "serve", score: 3, actionType: "ace" }),
        makeAction({ skill: "serve", score: 2, actionType: "difficult" }),
        makeAction({ skill: "receive", score: 2, actionType: "pass_b" }),
        makeAction({ skill: "receive", score: 2, actionType: "pass_b" }),
        makeAction({ skill: "receive", score: 2, actionType: "pass_b" }),
      ],
    });
    expect(result.impact?.strengths).toContain("saque");
  });

  test("recommendedFocus is limited to three items", () => {
    const actions = [
      ...Array.from({ length: 3 }, () => makeAction({ skill: "receive", score: 0 })),
      ...Array.from({ length: 3 }, () => makeAction({ skill: "coverage", score: 0 })),
      ...Array.from({ length: 3 }, () => makeAction({ skill: "transition", score: 1 })),
      ...Array.from({ length: 3 }, () => makeAction({ skill: "communication", score: 1 })),
    ];
    const result = generateScoutingImpactFromActions({
      classId: "class_1",
      scoutingSessionId: "session_1",
      date: "2026-05-09",
      actions,
    });
    expect(result.impact?.recommendedFocus).toHaveLength(3);
    expect(assertEvidenceRuleIds(result.impact?.evidenceTrace?.evidenceRuleIds ?? []).invalid).toEqual([]);
  });

  test("impact with loadImpact includes load monitoring evidence", () => {
    const actions = [
      ...Array.from({ length: 3 }, () => makeAction({ skill: "receive", score: 0 })),
      ...Array.from({ length: 3 }, () => makeAction({ skill: "coverage", score: 0 })),
    ];
    const result = generateScoutingImpactFromActions({
      classId: "class_1",
      scoutingSessionId: "session_1",
      date: "2026-05-09",
      actions,
      sessionType: "friendly",
    });
    expect(result.impact?.loadImpact).toBe("reduce");
    expect(result.impact?.evidenceTrace?.evidenceRuleIds).toContain("load_monitoring_signal_not_oracle");
    expect(result.impact?.evidenceRuleIds).toEqual(result.impact?.evidenceTrace?.evidenceRuleIds);
  });

  test("loadImpact does not increase automatically", () => {
    const actions = Array.from({ length: 6 }, () => makeAction({ skill: "serve", score: 3 }));
    expect(
      resolveLoadImpactFromSessionAndActions({
        classId: "class_1",
        scoutingSessionId: "session_1",
        date: "2026-05-09",
        actions,
        sessionType: "training",
      }),
    ).toBe("maintain");
  });

  test("priority by skill captures recurrent negatives", () => {
    const priorities = calculateScoutingPriorityBySkill([
      makeAction({ skill: "coverage", score: 0 }),
      makeAction({ skill: "coverage", score: 1 }),
      makeAction({ skill: "coverage", score: 1 }),
    ]);
    expect(priorities[0]?.weaknessLabel).toBe("cobertura pós-ataque");
  });
});
