import {
  getScopedAssistantPath,
  getScopedPlanningPath,
  getScopedProfilePath,
  getScopedProfileSettingsPath,
} from "../profile-routes";

describe("profile routes", () => {
  it("opens settings and returns to the profile in the same scope", () => {
    for (const prefix of ["", "/prof", "/coord", "/student"]) {
      const overview = `${prefix}/profile`;
      const settings = `${overview}/settings`;
      expect(getScopedProfileSettingsPath(overview)).toBe(settings);
      expect(getScopedProfilePath(settings)).toBe(overview);
      expect(getScopedProfileSettingsPath(`${settings}/`)).toBe(settings);
    }
  });
  it("keeps professor routes in the professor shell", () => {
    expect(getScopedAssistantPath("/prof/classes")).toBe("/prof/assistant");
    expect(getScopedPlanningPath("/prof/classes")).toBe("/prof/planning");
    expect(getScopedProfilePath("/prof/classes")).toBe("/prof/profile");
  });

  it("keeps coordination routes in the coordination shell", () => {
    expect(getScopedAssistantPath("/coord/classes")).toBe("/coord/assistant");
    expect(getScopedPlanningPath("/coord/classes")).toBe("/coord/planning");
    expect(getScopedProfilePath("/coord/classes")).toBe("/coord/profile");
  });
});
