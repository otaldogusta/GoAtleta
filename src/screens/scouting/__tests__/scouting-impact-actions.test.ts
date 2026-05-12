import { resetScoutingActionStore } from "../scouting-action-store";
import { resetScoutingSessionStore } from "../scouting-session-store";
import { resetTeamContextStore } from "../../team-context/team-context-store";
import { createScoutingActionForSession } from "../scouting-action-actions";
import { createAndStartScoutingSession } from "../scouting-session-actions";
import {
  generateAndSaveScoutingImpactForSession,
  listGeneratedScoutingImpactsByClass,
} from "../scouting-impact-actions";

describe("scouting-impact-actions", () => {
  beforeEach(async () => {
    await resetScoutingSessionStore();
    await resetScoutingActionStore();
    await resetTeamContextStore();
  });

  test("saves impact when session has enough recurring data", async () => {
    const session = await createAndStartScoutingSession({
      classId: "class_1",
      date: "2026-05-09",
      type: "friendly",
    });
    for (let i = 0; i < 3; i += 1) {
      await createScoutingActionForSession({
        scoutingSessionId: session.id,
        classId: "class_1",
        skill: "receive",
        actionType: "pass_c",
        quality: "low",
        score: 1,
      });
    }
    for (let i = 0; i < 3; i += 1) {
      await createScoutingActionForSession({
        scoutingSessionId: session.id,
        classId: "class_1",
        skill: "serve",
        actionType: "difficult",
        quality: "medium",
        score: 2,
      });
    }

    const result = await generateAndSaveScoutingImpactForSession(session.id);
    const saved = await listGeneratedScoutingImpactsByClass("class_1");
    expect(result.saved).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.recommendedFocus).toContain("recepção sob pressão");
  });

  test("does not break when session has insufficient data", async () => {
    const session = await createAndStartScoutingSession({
      classId: "class_1",
      date: "2026-05-09",
      type: "training",
    });
    await createScoutingActionForSession({
      scoutingSessionId: session.id,
      classId: "class_1",
      skill: "serve",
      actionType: "ace",
      quality: "excellent",
      score: 3,
    });

    const result = await generateAndSaveScoutingImpactForSession(session.id);
    expect(result.saved).toBe(false);
    expect(result.ignoredReasons).toContain("dados insuficientes");
  });
});
