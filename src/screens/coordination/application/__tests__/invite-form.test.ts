import {
  areInviteFormSnapshotsEqual,
  createInviteFormSnapshot,
  DEFAULT_INVITE_PERMISSION_KEYS,
} from "../invite-form";

describe("invite form snapshots", () => {
  it("protects class and existing-profile changes when closing the form", () => {
    const original = createInviteFormSnapshot({ email: "", role: "professor", permissionKeys: [], classIds: ["a", "b"] });
    expect(areInviteFormSnapshotsEqual(original, createInviteFormSnapshot({ ...original, classIds: ["b", "a", "a"] }))).toBe(true);
    expect(areInviteFormSnapshotsEqual(original, createInviteFormSnapshot({ ...original, classIds: ["a"] }))).toBe(false);
    expect(areInviteFormSnapshotsEqual(original, createInviteFormSnapshot({ ...original, staffProfileId: "profile" }))).toBe(false);
  });
  it("keeps financial access out of the default invitation permissions", () => {
    expect(DEFAULT_INVITE_PERMISSION_KEYS).not.toContain("financial");
  });

  it("ignores e-mail casing, surrounding spaces and permission ordering", () => {
    const initial = createInviteFormSnapshot({
      email: "PESSOA@EXEMPLO.COM",
      role: "professor",
      permissionKeys: ["classes", "calendar"],
    });
    const current = createInviteFormSnapshot({
      email: "  pessoa@exemplo.com  ",
      role: "professor",
      permissionKeys: ["calendar", "classes", "classes"],
    });

    expect(areInviteFormSnapshotsEqual(initial, current)).toBe(true);
  });

  it("detects changes in e-mail, role or permissions", () => {
    const initial = createInviteFormSnapshot({
      email: "",
      role: "professor",
      permissionKeys: ["classes"],
    });

    expect(
      areInviteFormSnapshotsEqual(
        initial,
        createInviteFormSnapshot({
          email: "pessoa@exemplo.com",
          role: "professor",
          permissionKeys: ["classes"],
        })
      )
    ).toBe(false);
    expect(
      areInviteFormSnapshotsEqual(
        initial,
        createInviteFormSnapshot({
          email: "",
          role: "intern",
          permissionKeys: ["classes"],
        })
      )
    ).toBe(false);
    expect(
      areInviteFormSnapshotsEqual(
        initial,
        createInviteFormSnapshot({
          email: "",
          role: "professor",
          permissionKeys: ["classes", "training"],
        })
      )
    ).toBe(false);
  });
});
