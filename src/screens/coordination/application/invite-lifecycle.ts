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
  if (invite.expires_at) {
    const expiresAt = new Date(invite.expires_at).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= nowMs) return "expired";
  }
  if (invite.claim_failed_at) return "claim_failed";
  if (invite.delivery_status === "delivery_failed") return "delivery_failed";
  return "sent";
};

export const inviteNeedsAction = (invite: TrainerInviteItem, nowMs = Date.now()) =>
  ["sent", "claim_failed", "delivery_failed"].includes(
    resolveInviteLifecycleStatus(invite, nowMs)
  );

export const inviteAppearsInPeople = (invite: TrainerInviteItem, nowMs = Date.now()) =>
  !["accepted", "revoked"].includes(resolveInviteLifecycleStatus(invite, nowMs));

export const INVITE_STATUS_LABELS: Record<InviteLifecycleStatus, string> = {
  accepted: "Aceito",
  revoked: "Cancelado",
  claim_failed: "Falha no vínculo",
  delivery_failed: "Falha no envio",
  expired: "Expirado",
  sent: "Pendente",
};

export const formatInviteValidity = (invite: TrainerInviteItem, nowMs = Date.now()) => {
  const expiresAt = invite.expires_at ? Date.parse(invite.expires_at) : NaN;
  if (!Number.isFinite(expiresAt)) return "";
  const date = new Date(expiresAt).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  return `${expiresAt <= nowMs ? "Venceu" : "Vence"} em ${date}`;
};
