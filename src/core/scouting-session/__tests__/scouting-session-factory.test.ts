import {
  archiveScoutingSession,
  buildScoutingSessionTitle,
  completeScoutingSession,
  createScoutingSessionDraft,
  startScoutingSession,
} from "..";

describe("scouting-session-factory", () => {
  test("creates draft session", () => {
    const session = createScoutingSessionDraft({
      classId: "class_1",
      date: "2026-05-09",
      type: "training",
    });
    expect(session.status).toBe("draft");
    expect(session.title).toBe("Scouting de treino");
  });

  test("builds title for training", () => {
    expect(buildScoutingSessionTitle({ type: "training" })).toBe("Scouting de treino");
  });

  test("builds title for friendly vs opponent", () => {
    expect(buildScoutingSessionTitle({ type: "friendly", opponent: "Maringá" })).toBe(
      "Amistoso vs Maringá"
    );
  });

  test("start moves to in_progress", () => {
    const started = startScoutingSession(
      createScoutingSessionDraft({
        classId: "class_1",
        date: "2026-05-09",
        type: "training",
      })
    );
    expect(started.status).toBe("in_progress");
  });

  test("complete moves to completed", () => {
    const completed = completeScoutingSession(
      startScoutingSession(
        createScoutingSessionDraft({
          classId: "class_1",
          date: "2026-05-09",
          type: "training",
        })
      )
    );
    expect(completed.status).toBe("completed");
  });

  test("archive moves to archived", () => {
    const archived = archiveScoutingSession(
      createScoutingSessionDraft({
        classId: "class_1",
        date: "2026-05-09",
        type: "training",
      })
    );
    expect(archived.status).toBe("archived");
  });

  test("archived does not go back to in_progress", () => {
    const archived = archiveScoutingSession(
      createScoutingSessionDraft({
        classId: "class_1",
        date: "2026-05-09",
        type: "training",
      })
    );
    expect(startScoutingSession(archived).status).toBe("archived");
  });
});
