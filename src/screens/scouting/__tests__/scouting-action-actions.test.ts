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
});
