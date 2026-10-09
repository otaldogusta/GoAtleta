// Public preview deliberately excludes identity, organization and permissions.
export type TrainerInviteAvailability = {
  revoked: boolean;
  claimed_by: string | null;
  uses: number;
  max_uses: number;
  expires_at: string | null;
};

export function isTrainerInviteAvailable(invite: TrainerInviteAvailability | null, now = Date.now()): boolean {
  if (!invite || invite.revoked || invite.claimed_by || !Number.isFinite(invite.uses) ||
      !Number.isFinite(invite.max_uses) || invite.uses >= invite.max_uses) return false;
  if (invite.expires_at !== null) {
    const expiresAt = Date.parse(invite.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  }
  return true;
}
