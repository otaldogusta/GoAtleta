import { createScoutingAction } from "../scouting-action-factory";
import {
  getAthletesInFocus,
  getAthletesNeedingAttention,
  summarizeScoutingActionsByAthleteDetailed,
} from "../scouting-athlete-summary";
import type { ScoutingAction } from "../types";

const makeAction = (overrides: Partial<ScoutingAction> = {}) =>
  ({
    ...createScoutingAction({
      scoutingSessionId: "session_1",
      classId: "class_1",
      athleteName: "Maria",
      skill: "receive",
      actionType: "pass_a",
      quality: "high",
      score: 3,
    }),
    ...overrides,
  }) as ScoutingAction;

describe("scouting-athlete-summary", () => {
  test("groups actions by athlete and calculates total/average", () => {
    const summaries = summarizeScoutingActionsByAthleteDetailed([
      makeAction({ athleteName: "Maria", score: 3 }),
      makeAction({ athleteName: "Maria", score: 2 }),
      makeAction({ athleteName: "Ana", score: 1 }),
      makeAction({ athleteName: "Ana", score: 0 }),
    ]);

    const maria = summaries.find((item) => item.athleteName === "Maria");
    expect(maria?.totalActions).toBe(2);
    expect(maria?.averageScore).toBe(2.5);
  });

  test("identifies strongest skill with enough data", () => {
    const [summary] = summarizeScoutingActionsByAthleteDetailed([
      makeAction({ athleteName: "Maria", skill: "defense", score: 3 }),
      makeAction({ athleteName: "Maria", skill: "defense", score: 3 }),
      makeAction({ athleteName: "Maria", skill: "serve", score: 1 }),
    ]);

    expect(summary?.strongestSkill).toBe("Defesa");
    expect(summary?.strengths).toContain("Defesa");
  });

  test("identifies weakest skill with enough data", () => {
    const [summary] = summarizeScoutingActionsByAthleteDetailed([
      makeAction({ athleteName: "Ana", skill: "serve", score: 0 }),
      makeAction({ athleteName: "Ana", skill: "serve", score: 1 }),
      makeAction({ athleteName: "Ana", skill: "receive", score: 3 }),
    ]);

    expect(summary?.weakestSkill).toBe("Saque");
    expect(summary?.attentionPoints).toContain("Saque");
  });

  test("does not create strong conclusion with insufficient data", () => {
    const [summary] = summarizeScoutingActionsByAthleteDetailed([
      makeAction({ athleteName: "Júlia", skill: "attack", score: 3 }),
    ]);

    expect(summary?.strongestSkill).toBeUndefined();
    expect(summary?.weakestSkill).toBeUndefined();
    expect(summary?.strengths).toContain("dados insuficientes");
    expect(summary?.attentionPoints).toContain("dados insuficientes");
  });

  test("groups unidentified actions as Equipe", () => {
    const summaries = summarizeScoutingActionsByAthleteDetailed([
      makeAction({ athleteName: undefined, athleteId: undefined }),
    ]);
    expect(summaries[0]?.athleteName).toBe("Equipe");
  });

  test("getAthletesInFocus returns best summaries", () => {
    const focus = getAthletesInFocus([
      makeAction({ athleteName: "Maria", score: 3 }),
      makeAction({ athleteName: "Maria", score: 3 }),
      makeAction({ athleteName: "Ana", score: 1 }),
      makeAction({ athleteName: "Ana", score: 1 }),
    ]);

    expect(focus[0]?.athleteName).toBe("Maria");
  });

  test("getAthletesNeedingAttention returns lowest summaries", () => {
    const attention = getAthletesNeedingAttention([
      makeAction({ athleteName: "Maria", skill: "receive", score: 3 }),
      makeAction({ athleteName: "Maria", skill: "receive", score: 3 }),
      makeAction({ athleteName: "Ana", skill: "serve", score: 0 }),
      makeAction({ athleteName: "Ana", skill: "serve", score: 1 }),
    ]);

    expect(attention[0]?.athleteName).toBe("Ana");
    expect(attention[0]?.weakestSkill).toBe("Saque");
  });
});
