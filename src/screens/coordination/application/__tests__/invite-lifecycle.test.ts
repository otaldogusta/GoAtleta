import type { TrainerInviteItem } from "../../../../api/trainer-invite";
import {
  inviteNeedsAction,
  inviteAppearsInPeople,
  INVITE_STATUS_LABELS,
  formatInviteValidity,
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

  it("expires at the exact deadline, including earlier delivery or claim failures", () => {
    for (const failure of [{}, { claim_failed_at: "2026-08-12T11:00:00Z" }, { delivery_status: "delivery_failed" as const }]) {
      const item = invite({ ...failure, expires_at: new Date(now).toISOString() });
      expect(resolveInviteLifecycleStatus(item, now - 1)).not.toBe("expired");
      expect(resolveInviteLifecycleStatus(item, now)).toBe("expired");
      expect(inviteNeedsAction(item, now)).toBe(false);
      expect(inviteAppearsInPeople(item, now)).toBe(true);
    }
  });

  it("keeps expired invitations visible but removes accepted and cancelled ones", () => {
    expect(inviteAppearsInPeople(invite(), now)).toBe(true);
    expect(inviteAppearsInPeople(invite({ claimed_at: new Date(now).toISOString() }), now)).toBe(false);
    expect(inviteAppearsInPeople(invite({ revoked: true }), now)).toBe(false);
    expect(INVITE_STATUS_LABELS.expired).toBe("Expirado");
    expect(INVITE_STATUS_LABELS.claim_failed).not.toBe("Pendente");
  });

  it("does not turn completed or cancelled invitations into expired ones", () => {
    const expired = { expires_at: new Date(now - 1).toISOString() };
    expect(resolveInviteLifecycleStatus(invite({ ...expired, claimed_by: "user" }), now)).toBe("accepted");
    expect(resolveInviteLifecycleStatus(invite({ ...expired, revoked: true }), now)).toBe("revoked");
  });

  it("formats validity without inventing an expiry for missing or invalid dates", () => {
    expect(formatInviteValidity(invite(), now)).toContain("Vence em");
    expect(formatInviteValidity(invite({ expires_at: new Date(now).toISOString() }), now)).toContain("Venceu em");
    expect(formatInviteValidity(invite({ expires_at: null }), now)).toBe("");
    expect(formatInviteValidity(invite({ expires_at: "invalid" }), now)).toBe("");
  });
});
