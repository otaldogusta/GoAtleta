import {
  areMemberAccessFormSnapshotsEqual,
  createMemberAccessFormSnapshot,
  createMemberAccessIdempotencyKey,
  formatMemberAccessSuccessMessage,
  preserveOwnMemberManagementPermission,
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

  it("creates UUID-shaped idempotency keys", () => {
    expect(createMemberAccessIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("formats an explicit success receipt including the inbox notification", () => {
    expect(
      formatMemberAccessSuccessMessage({
        displayName: "Angela Moraes",
        classCount: 6,
        permissionCount: 7,
        notificationCreated: true,
      })
    ).toBe(
      "Acesso de Angela atualizado: 6 turma(s) e 7 permissão(ões). A notificação já está na caixa de entrada."
    );
  });

  it("preserves member management when editing the signed-in user", () => {
    expect(
      preserveOwnMemberManagementPermission({
        actorUserId: "user-1",
        targetUserId: "user-1",
        permissionKeys: ["classes", "training"],
      })
    ).toEqual(["classes", "training", "org_members"]);
  });

  it("does not change another member permissions or duplicate the protected key", () => {
    expect(
      preserveOwnMemberManagementPermission({
        actorUserId: "user-1",
        targetUserId: "user-2",
        permissionKeys: ["classes"],
      })
    ).toEqual(["classes"]);
    expect(
      preserveOwnMemberManagementPermission({
        actorUserId: "user-1",
        targetUserId: "user-1",
        permissionKeys: ["org_members", "classes"],
      })
    ).toEqual(["org_members", "classes"]);
  });
});
