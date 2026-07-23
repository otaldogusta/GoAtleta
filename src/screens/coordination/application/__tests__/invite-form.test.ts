import {
  areInviteFormSnapshotsEqual,
  createInviteFormSnapshot,
} from "../invite-form";

describe("invite form snapshots", () => {
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
