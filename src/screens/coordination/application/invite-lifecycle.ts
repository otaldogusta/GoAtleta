import type { TrainerInviteItem } from "../../../api/trainer-invite";

export type InviteLifecycleStatus =
  | "accepted"
  | "revoked"
  | "claim_failed"
  | "delivery_failed"
  | "expired"
  | "sent";

export const resolveInviteLifecycleStatus = (
  invite: TrainerInviteItem,
  nowMs = Date.now()
): InviteLifecycleStatus => {
  if (invite.claimed_by || invite.claimed_at || invite.uses >= invite.max_uses) {
    return "accepted";
  }
  if (invite.revoked) return "revoked";
  if (invite.claim_failed_at) return "claim_failed";
  if (invite.delivery_status === "delivery_failed") return "delivery_failed";
  if (invite.expires_at) {
    const expiresAt = new Date(invite.expires_at).getTime();
    if (Number.isFinite(expiresAt) && expiresAt < nowMs) return "expired";
  }
  return "sent";
};

export const inviteNeedsAction = (invite: TrainerInviteItem, nowMs = Date.now()) =>
  ["sent", "claim_failed", "delivery_failed"].includes(
    resolveInviteLifecycleStatus(invite, nowMs)
  );
