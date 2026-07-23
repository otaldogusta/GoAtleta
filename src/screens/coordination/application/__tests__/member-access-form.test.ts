import {
  areMemberAccessFormSnapshotsEqual,
  createMemberAccessFormSnapshot,
} from "../member-access-form";

describe("member access form snapshots", () => {
  it("ignores ordering and repeated selections", () => {
    const initial = createMemberAccessFormSnapshot({
      role: 10,
      classIds: ["class-b", "class-a"],
      permissionKeys: ["classes", "training"],
    });
    const current = createMemberAccessFormSnapshot({
      role: 10,
      classIds: ["class-a", "class-b", "class-a"],
      permissionKeys: ["training", "classes"],
    });

    expect(areMemberAccessFormSnapshotsEqual(initial, current)).toBe(true);
  });

  it("detects changes in role, classes or permissions", () => {
    const initial = createMemberAccessFormSnapshot({
      role: 10,
      classIds: ["class-a"],
      permissionKeys: ["classes"],
    });

    expect(
      areMemberAccessFormSnapshotsEqual(
        initial,
        createMemberAccessFormSnapshot({
          role: 50,
          classIds: ["class-a"],
          permissionKeys: ["classes"],
        })
      )
    ).toBe(false);
    expect(
      areMemberAccessFormSnapshotsEqual(
        initial,
        createMemberAccessFormSnapshot({
          role: 10,
          classIds: ["class-a", "class-b"],
          permissionKeys: ["classes"],
        })
      )
    ).toBe(false);
    expect(
      areMemberAccessFormSnapshotsEqual(
        initial,
        createMemberAccessFormSnapshot({
          role: 10,
          classIds: ["class-a"],
          permissionKeys: ["classes", "training"],
        })
      )
    ).toBe(false);
  });
});
