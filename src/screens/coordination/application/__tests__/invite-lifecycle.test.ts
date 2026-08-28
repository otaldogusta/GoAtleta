import type { TrainerInviteItem } from "../../../../api/trainer-invite";
import {
  inviteNeedsAction,
  resolveInviteLifecycleStatus,
} from "../invite-lifecycle";

const invite = (overrides: Partial<TrainerInviteItem> = {}): TrainerInviteItem => ({
  id: "invite-1",
  organization_id: "org-1",
  target_role_level: 10,
  created_at: "2026-08-12T10:00:00.000Z",
  expires_at: "2026-08-20T10:00:00.000Z",
  max_uses: 1,
  uses: 0,
  revoked: false,
  invited_via: "email",
  invited_to: "maria@example.com",
  delivery_status: "sent",
  ...overrides,
});

describe("invite lifecycle", () => {
  const now = new Date("2026-08-12T12:00:00.000Z").getTime();

  it("prioritizes completed membership over transport history", () => {
    expect(
      resolveInviteLifecycleStatus(
        invite({ claimed_by: "user-1", claim_failed_at: "2026-08-12T11:00:00.000Z" }),
        now
      )
    ).toBe("accepted");
  });

  it.each([
    [{ revoked: true, revoked_at: "2026-08-12T11:30:00.000Z" }, "revoked"],
    [{ claim_failed_at: "2026-08-12T11:00:00.000Z" }, "claim_failed"],
    [{ delivery_status: "delivery_failed" }, "delivery_failed"],
    [{ expires_at: "2026-08-11T10:00:00.000Z" }, "expired"],
    [{}, "sent"],
  ] as [Partial<TrainerInviteItem>, string][])(
    "maps operational invitation states",
    (overrides, expected) => {
      expect(resolveInviteLifecycleStatus(invite(overrides), now)).toBe(expected);
    }
  );

  it("keeps only actionable invitation states in the pending count", () => {
    expect(inviteNeedsAction(invite(), now)).toBe(true);
    expect(inviteNeedsAction(invite({ claimed_by: "user-1" }), now)).toBe(false);
    expect(inviteNeedsAction(invite({ revoked: true }), now)).toBe(false);
    expect(inviteNeedsAction(invite({ expires_at: "2026-08-11T10:00:00.000Z" }), now)).toBe(false);
  });
});
