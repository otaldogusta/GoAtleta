import {
  buildLegacyScoutingRoute,
  buildScoutingSessionDraftInput,
  buildScoutingSessionRoute,
} from "../scouting-session-navigation";

describe("scouting-session-navigation", () => {
  test("builds draft input from ui type", () => {
    expect(
      buildScoutingSessionDraftInput({
        classId: "class_1",
        date: "2026-05-09",
        uiType: "amistoso",
        opponent: "Maringá",
        source: "manual",
      })
    ).toEqual({
      classId: "class_1",
      date: "2026-05-09",
      type: "friendly",
      opponent: "Maringá",
      source: "manual",
    });
  });

  test("builds dedicated scouting route", () => {
    expect(
      buildScoutingSessionRoute({
        classId: "class_1",
        scoutingSessionId: "session_1",
      })
    ).toEqual({
      pathname: "/class/[id]/scouting/[scoutingSessionId]",
      params: {
        id: "class_1",
        scoutingSessionId: "session_1",
      },
    });
  });

  test("builds legacy route from scouting session", () => {
    expect(
      buildLegacyScoutingRoute({
        classId: "class_1",
        session: {
          id: "session_1",
          classId: "class_1",
          date: "2026-05-09",
          type: "official_match",
          title: "Jogo vs X",
          status: "in_progress",
          createdAt: "2026-05-09T10:00:00.000Z",
        },
      })
    ).toEqual({
      pathname: "/class/[id]/session",
      params: {
        id: "class_1",
        tab: "scouting",
        source: "scouting_module",
        date: "2026-05-09",
        scoutingMode: "jogo",
        scoutingSessionId: "session_1",
        opponent: undefined,
      },
    });
  });
});
