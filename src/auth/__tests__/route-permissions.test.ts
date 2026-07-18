import {
  getTrainerPermissionKey,
  isTrainerPathAllowed,
} from "../route-permissions";

describe("trainer route permissions", () => {
  it("matches exact routes and nested routes without prefix collisions", () => {
    expect(getTrainerPermissionKey("/prof/calendar")).toBe("calendar");
    expect(getTrainerPermissionKey("/prof/calendar/month")).toBe("calendar");
    expect(getTrainerPermissionKey("/prof/calendarized")).toBeNull();
  });

  it("blocks explicitly disabled screens for regular members", () => {
    expect(
      isTrainerPathAllowed(
        "/prof/absence-notices",
        { absence_notices: false },
        false
      )
    ).toBe(false);
  });

  it("keeps unspecified screens available and bypasses restrictions for org admins", () => {
    expect(isTrainerPathAllowed("/prof/home", {}, false)).toBe(true);
    expect(
      isTrainerPathAllowed("/prof/calendar", { calendar: false }, true)
    ).toBe(true);
  });
});
