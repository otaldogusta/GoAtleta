import { resolveNotificationOrganizationId } from "../notification-organization";

describe("notification organization", () => {
  test("prefers the active organization for professor and coordination inboxes", () => {
    expect(
      resolveNotificationOrganizationId({
        activeOrganizationId: "org-active",
        studentOrganizationId: "org-student",
        inboxScope: "prof",
      }),
    ).toBe("org-active");

    expect(
      resolveNotificationOrganizationId({
        activeOrganizationId: "org-active",
        studentOrganizationId: "org-student",
        inboxScope: "coord",
      }),
    ).toBe("org-active");
  });

  test("prefers the linked student organization for the student inbox", () => {
    expect(
      resolveNotificationOrganizationId({
        activeOrganizationId: "org-active",
        studentOrganizationId: "org-student",
        inboxScope: "student",
      }),
    ).toBe("org-student");
  });

  test("prefers the linked student organization for the effective student profile", () => {
    expect(
      resolveNotificationOrganizationId({
        activeOrganizationId: "org-active",
        studentOrganizationId: "org-student",
        effectiveProfile: "student",
      }),
    ).toBe("org-student");
  });

  test("falls back safely when the preferred organization is unavailable", () => {
    expect(
      resolveNotificationOrganizationId({
        activeOrganizationId: null,
        studentOrganizationId: "org-student",
        inboxScope: "prof",
      }),
    ).toBe("org-student");

    expect(
      resolveNotificationOrganizationId({
        activeOrganizationId: "org-active",
        studentOrganizationId: null,
        inboxScope: "student",
      }),
    ).toBe("org-active");
  });

  test("ignores empty identifiers", () => {
    expect(
      resolveNotificationOrganizationId({
        activeOrganizationId: "  ",
        studentOrganizationId: " ",
      }),
    ).toBeNull();
  });
});
