import {
  getExplicitProfileRouteScope,
  getTrainerScopedRoutes,
  resolveTrainerRouteScope,
  shouldWrapSharedProfileRoute,
} from "../profile-route-scope";

describe("profile route scope", () => {
  it("uses the explicit URL before account privileges", () => {
    expect(
      resolveTrainerRouteScope({ pathname: "/prof/classes", effectiveProfile: "admin" }),
    ).toBe("prof");
    expect(
      resolveTrainerRouteScope({
        pathname: "/coord/classes",
        effectiveProfile: "professor",
      }),
    ).toBe("coord");
  });

  it("keeps shared class routes in the last trainer shell", () => {
    expect(
      resolveTrainerRouteScope({
        pathname: "/class/c_123",
        effectiveProfile: "admin",
        storedScope: "prof",
      }),
    ).toBe("prof");
    expect(
      resolveTrainerRouteScope({
        pathname: "/class/c_123/attendance",
        effectiveProfile: "professor",
        storedScope: "coord",
      }),
    ).toBe("coord");
  });

  it("exposes complete routes for each trainer shell", () => {
    expect(getTrainerScopedRoutes("prof")).toMatchObject({
      home: "/prof/home",
      classes: "/prof/classes",
      planning: "/prof/planning",
      reports: "/prof/classes",
      nfcAttendance: "/prof/nfc-attendance",
    });
    expect(getTrainerScopedRoutes("coord")).toMatchObject({
      home: "/coord/dashboard",
      classes: "/coord/classes",
      students: "/coord/management/athletes",
      planning: "/coord/planning",
      reports: "/coord/management",
      nfcAttendance: "/coord/nfc-attendance",
    });
  });

  it("recognizes explicit and legacy shared routes", () => {
    expect(getExplicitProfileRouteScope("/prof/classes")).toBe("prof");
    expect(getExplicitProfileRouteScope("/coord/students")).toBe("coord");
    expect(shouldWrapSharedProfileRoute("/class/c_123/planning")).toBe(true);
    expect(shouldWrapSharedProfileRoute("/training")).toBe(true);
    expect(shouldWrapSharedProfileRoute("/welcome")).toBe(false);
  });
});
