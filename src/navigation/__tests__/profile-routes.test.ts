import {
  getScopedAssistantPath,
  getScopedPlanningPath,
  getScopedProfilePath,
} from "../profile-routes";

describe("profile routes", () => {
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
