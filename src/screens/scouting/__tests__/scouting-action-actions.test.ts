import {
  createScoutingActionForSession,
  deleteScoutingAction,
  listScoutingActionsByAthlete,
  listScoutingActionsByClass,
  listScoutingActionsBySession,
} from "../scouting-action-actions";
import { resetScoutingActionStore } from "../scouting-action-store";

describe("scouting-action-actions", () => {
  beforeEach(async () => {
    await resetScoutingActionStore();
  });

  test("actions list by session", async () => {
    await createScoutingActionForSession({
      scoutingSessionId: "session_1",
      classId: "class_1",
      athleteName: "Maria",
      skill: "receive",
      actionType: "Passe A",
      quality: "A",
    });
    const actions = await listScoutingActionsBySession("session_1");
    expect(actions).toHaveLength(1);
  });

  test("actions list by athlete", async () => {
    await createScoutingActionForSession({
      scoutingSessionId: "session_1",
      classId: "class_1",
      athleteId: "athlete_1",
      athleteName: "Maria",
      skill: "receive",
      actionType: "Passe A",
      quality: "A",
    });
    const actions = await listScoutingActionsByAthlete("athlete_1");
    expect(actions).toHaveLength(1);
  });

  test("actions list by class", async () => {
    await createScoutingActionForSession({
      scoutingSessionId: "session_1",
      classId: "class_1",
      athleteName: "Maria",
      skill: "receive",
      actionType: "Passe A",
      quality: "A",
    });
    const actions = await listScoutingActionsByClass("class_1");
    expect(actions).toHaveLength(1);
  });

  test("delete action removes record", async () => {
    const action = await createScoutingActionForSession({
      scoutingSessionId: "session_1",
      classId: "class_1",
      athleteName: "Maria",
      skill: "receive",
      actionType: "Passe A",
      quality: "A",
    });
    await deleteScoutingAction(action.id);
    const actions = await listScoutingActionsBySession("session_1");
    expect(actions).toHaveLength(0);
  });

  test("actions can include video context", async () => {
    const action = await createScoutingActionForSession({
      scoutingSessionId: "session_1",
      classId: "class_1",
      skill: "serve",
      actionType: "difficult",
      quality: "medium",
      videoTimestampMs: 1000,
      videoLabel: "Saque no início do recorte",
      clipReference: "serve_rally",
    });

    expect(action.videoTimestampMs).toBe(1000);
    expect(action.videoLabel).toBe("Saque no início do recorte");
    const actions = await listScoutingActionsBySession("session_1");
    expect(actions[0]?.clipReference).toBe("serve_rally");
  });
});
