import {
  archiveScoutingSessionById,
  completeScoutingSessionById,
  createAndStartScoutingSession,
  createScoutingSession,
  getScoutingSession,
  listScoutingSessionsByClass,
  startScoutingSessionById,
} from "../scouting-session-actions";
import { resetScoutingSessionStore } from "../scouting-session-store";

describe("scouting-session-actions", () => {
  beforeEach(async () => {
    await resetScoutingSessionStore();
  });

  test("creates and lists by class", async () => {
    const created = await createScoutingSession({
      classId: "class_1",
      date: "2026-05-09",
      type: "training",
    });
    expect(created.status).toBe("draft");
    const sessions = await listScoutingSessionsByClass("class_1");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toBe(created.id);
  });

  test("gets by id", async () => {
    const created = await createScoutingSession({
      classId: "class_1",
      date: "2026-05-09",
      type: "training",
    });
    const loaded = await getScoutingSession(created.id);
    expect(loaded?.id).toBe(created.id);
  });

  test("start, complete and archive update state", async () => {
    const created = await createScoutingSession({
      classId: "class_1",
      date: "2026-05-09",
      type: "training",
    });
    const started = await startScoutingSessionById(created.id);
    const completed = await completeScoutingSessionById(created.id);
    const archived = await archiveScoutingSessionById(created.id);
    expect(started?.status).toBe("in_progress");
    expect(completed?.status).toBe("completed");
    expect(archived?.status).toBe("archived");
  });

  test("orders by date desc", async () => {
    await createScoutingSession({
      classId: "class_1",
      date: "2026-05-08",
      type: "training",
    });
    const latest = await createScoutingSession({
      classId: "class_1",
      date: "2026-05-09",
      type: "friendly",
      opponent: "Maringá",
    });
    const sessions = await listScoutingSessionsByClass("class_1");
    expect(sessions[0]?.id).toBe(latest.id);
  });

  test("createAndStartScoutingSession returns in_progress", async () => {
    const session = await createAndStartScoutingSession({
      classId: "class_1",
      date: "2026-05-09",
      type: "training",
    });
    expect(session.status).toBe("in_progress");
  });

  test("creates video scouting session", async () => {
    const session = await createAndStartScoutingSession({
      classId: "class_1",
      date: "2026-05-09",
      type: "friendly",
      opponent: "Regenerados",
      sourceType: "video",
      videoClipType: "serve_rally",
      videoNotes: "Vídeo editado com lances de saque e rally.",
    });

    expect(session.status).toBe("in_progress");
    expect(session.sourceType).toBe("video");
    expect(session.videoClipType).toBe("serve_rally");
  });
});
