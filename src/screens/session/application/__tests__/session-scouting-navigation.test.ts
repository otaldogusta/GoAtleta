import {
  buildScoutingNewRouteParams,
  isScoutingModuleSession,
  shouldRedirectLegacyScoutingTab,
} from "../session-scouting-navigation";

describe("session-scouting-navigation", () => {
  test("recognizes hidden scouting flow from scouting module", () => {
    expect(isScoutingModuleSession("scouting", "scouting_module")).toBe(true);
    expect(isScoutingModuleSession("scouting", "session")).toBe(false);
  });

  test("legacy scouting tab should redirect when source is not scouting module", () => {
    expect(shouldRedirectLegacyScoutingTab("scouting", "session")).toBe(true);
    expect(shouldRedirectLegacyScoutingTab("scouting", "scouting_module")).toBe(false);
    expect(shouldRedirectLegacyScoutingTab("treino", "session")).toBe(false);
  });

  test("builds scouting new route params from session context", () => {
    expect(
      buildScoutingNewRouteParams({
        classId: "class_1",
        date: "2026-05-09",
      })
    ).toEqual({
      id: "class_1",
      date: "2026-05-09",
      type: "training",
      source: "session",
    });
  });
});
