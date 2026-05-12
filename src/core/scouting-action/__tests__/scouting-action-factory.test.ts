import {
  createScoutingAction,
  deriveActionScore,
  normalizeScoutingQuality,
  normalizeScoutingSkill,
} from "..";

describe("scouting-action-factory", () => {
  test("creates valid action without athleteId", () => {
    const action = createScoutingAction({
      scoutingSessionId: "session_1",
      classId: "class_1",
      athleteName: "Maria",
      skill: "Recepção",
      actionType: "pass_a",
      label: "A / Alto",
      quality: "A",
    });
    expect(action.skill).toBe("receive");
    expect(action.quality).toBe("excellent");
    expect(action.score).toBe(3);
    expect(action.athleteId).toBeUndefined();
    expect(action.actionType).toBe("pass_a");
    expect(action.label).toBe("A / Alto");
  });

  test("derives score by quality", () => {
    expect(deriveActionScore("error")).toBe(0);
    expect(deriveActionScore("low")).toBe(1);
    expect(deriveActionScore("medium")).toBe(2);
    expect(deriveActionScore("high")).toBe(3);
    expect(deriveActionScore("excellent")).toBe(3);
  });

  test("maps receive A/B/C", () => {
    expect(deriveActionScore("A", "receive")).toBe(3);
    expect(deriveActionScore("B", "receive")).toBe(2);
    expect(deriveActionScore("C", "receive")).toBe(1);
  });

  test("maps serve variants", () => {
    expect(deriveActionScore("error", "serve")).toBe(0);
    expect(deriveActionScore("in_play", "serve")).toBe(1);
    expect(deriveActionScore("difficult", "serve")).toBe(2);
    expect(deriveActionScore("ace", "serve")).toBe(3);
  });

  test("normalizes aliases", () => {
    expect(normalizeScoutingSkill("Comunicação")).toBe("communication");
    expect(normalizeScoutingQuality("excelente")).toBe("excellent");
  });

  test("keeps optional video context", () => {
    const action = createScoutingAction({
      scoutingSessionId: "session_1",
      classId: "class_1",
      skill: "serve",
      actionType: "difficult",
      quality: "medium",
      videoTimestampMs: 12345,
      videoLabel: "Saque no início do recorte",
      clipReference: "serve_rally",
    });

    expect(action.videoTimestampMs).toBe(12345);
    expect(action.videoLabel).toBe("Saque no início do recorte");
    expect(action.clipReference).toBe("serve_rally");
  });
});
