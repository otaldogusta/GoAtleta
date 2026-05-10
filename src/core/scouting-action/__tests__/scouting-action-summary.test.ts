import {
  createScoutingAction,
  getDominantStrengths,
  getDominantWeaknesses,
  summarizeScoutingActions,
  summarizeScoutingActionsByAthlete,
  summarizeScoutingActionsBySkill,
} from "..";

const makeAction = (overrides: Partial<ReturnType<typeof createScoutingAction>> = {}) =>
  ({
    ...createScoutingAction({
      scoutingSessionId: "session_1",
      classId: "class_1",
      athleteName: "Maria",
      skill: "receive",
      actionType: "Passe",
      quality: "excellent",
    }),
    ...overrides,
  });

describe("scouting-action-summary", () => {
  test("groups by athlete", () => {
    const items = summarizeScoutingActionsByAthlete([
      makeAction({ athleteName: "Maria" }),
      makeAction({ athleteName: "Ana", skill: "serve", quality: "error", score: 0 }),
    ]);
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.athleteName)).toContain("Maria");
  });

  test("groups by skill", () => {
    const items = summarizeScoutingActionsBySkill([
      makeAction({ skill: "receive" }),
      makeAction({ skill: "serve", quality: "error", score: 0 }),
    ]);
    expect(items.map((item) => item.skill)).toEqual(expect.arrayContaining(["receive", "serve"]));
  });

  test("finds dominant weaknesses", () => {
    const weaknesses = getDominantWeaknesses([
      makeAction({ skill: "serve", quality: "error", score: 0 }),
      makeAction({ skill: "serve", quality: "low", score: 1 }),
    ]);
    expect(weaknesses).toContain("Saque");
  });

  test("finds dominant strengths", () => {
    const strengths = getDominantStrengths([
      makeAction({ skill: "receive", quality: "excellent", score: 3 }),
      makeAction({ skill: "receive", quality: "high", score: 3 }),
    ]);
    expect(strengths).toContain("Recepção");
  });

  test("summarizes total actions", () => {
    const summary = summarizeScoutingActions([
      makeAction({ skill: "receive" }),
      makeAction({ skill: "serve", quality: "error", score: 0 }),
    ]);
    expect(summary.totalActions).toBe(2);
  });
});
