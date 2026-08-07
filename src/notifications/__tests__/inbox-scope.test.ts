import {
  notificationInboxFilter,
  notificationScopeForEffectiveProfile,
  resolveNotificationInboxScope,
} from "../inbox-scope";

describe("notification inbox scope", () => {
  test("maps application profiles to separate notification boxes", () => {
    expect(notificationScopeForEffectiveProfile("professor")).toBe("prof");
    expect(notificationScopeForEffectiveProfile("admin")).toBe("coord");
    expect(notificationScopeForEffectiveProfile("student")).toBe("student");
  });

  test("prefers the explicit route over the account default profile", () => {
    expect(
      resolveNotificationInboxScope({
        pathname: "/coord/assistant",
        effectiveProfile: "professor",
      }),
    ).toBe("coord");
    expect(
      resolveNotificationInboxScope({
        pathname: "/prof/absence-notices",
        effectiveProfile: "admin",
      }),
    ).toBe("prof");
  });

  test("includes explicitly shared announcements in a profile inbox", () => {
    expect(notificationInboxFilter("coord")).toBe("inbox_scope=in.(coord,all)");
    expect(notificationInboxFilter("all")).toBe("inbox_scope=eq.all");
  });
});
