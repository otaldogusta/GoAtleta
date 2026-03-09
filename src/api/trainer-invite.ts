import { getValidAccessToken } from "../auth/session";
import { SUPABASE_URL } from "./config";
import { parseInviteApiResponse } from "./invite-errors";

export type TrainerInviteRole = "collaborator" | "moderator";

export type TrainerInviteItem = {
  id: string;
  organization_id: string | null;
  target_role_level: number;
  created_at: string;
  expires_at: string | null;
  max_uses: number;
  uses: number;
  revoked: boolean;
  invited_via: string;
  invited_to: string | null;
};

const base = SUPABASE_URL.replace(/\/$/, "");

const authedPost = async (path: string, body: Record<string, unknown>) => {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Missing auth token");
  }
  return await fetch(base + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
};

export async function claimTrainerInvite(code: string) {
  const res = await authedPost("/functions/v1/claim-trainer-invite", { code });
  return await parseInviteApiResponse<{ status: "ok" }>(
    res,
    "Falha ao validar convite."
  );
}

export async function createTrainerInvite(options: {
  organizationId: string;
  role: TrainerInviteRole;
  invitedTo?: string;
}) {
  const res = await authedPost("/functions/v1/create-trainer-invite", {
    organizationId: options.organizationId,
    role: options.role,
    invitedTo: options.invitedTo,
    invitedVia: "link",
    maxUses: 1,
  });
  return await parseInviteApiResponse<{
    code: string;
    signup_link: string;
    invite: TrainerInviteItem;
  }>(res, "Falha ao criar convite de membro.");
}

export async function listTrainerInvites(organizationId: string) {
  const res = await authedPost("/functions/v1/list-trainer-invites", {
    organizationId,
  });
  return await parseInviteApiResponse<{ invites: TrainerInviteItem[] }>(
    res,
    "Falha ao listar convites de membro."
  );
}

export async function revokeTrainerInvite(inviteId: string, organizationId: string) {
  const res = await authedPost("/functions/v1/revoke-trainer-invite", {
    inviteId,
    organizationId,
  });
  return await parseInviteApiResponse<{ status: "ok" }>(
    res,
    "Falha ao cancelar convite de membro."
  );
}
