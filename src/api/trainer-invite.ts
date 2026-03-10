import { forceRefreshAccessToken, getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
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

type AuthOverride = {
  accessToken?: string;
  refreshToken?: string;
};

type RefreshResponse = {
  access_token?: string;
};

const refreshAccessTokenFromOverride = async (refreshToken: string): Promise<string> => {
  const token = refreshToken.trim();
  if (!token) return "";
  try {
    const res = await fetch(
      base + "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: token }),
      }
    );
    if (!res.ok) return "";
    const payload = (await res.json()) as RefreshResponse;
    return payload?.access_token?.trim() ?? "";
  } catch {
    return "";
  }
};

const authedPost = async (
  path: string,
  body: Record<string, unknown>,
  auth?: AuthOverride
) => {
  const waitForAccessToken = async (): Promise<string> => {
    let token = await getValidAccessToken();
    if (token) return token;

    const provided = auth?.accessToken?.trim() ?? "";
    if (provided) return provided;

    // Handles startup/login races where session persistence completes moments later.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      token = await getValidAccessToken();
      if (token) return token;
    }
    return "";
  };

  const token = await waitForAccessToken();
  if (!token) {
    throw new Error("Missing auth token");
  }
  const doFetch = (accessToken: string) =>
    fetch(base + path, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedFromSession = await forceRefreshAccessToken();
    const refreshedFromOverride = auth?.refreshToken
      ? await refreshAccessTokenFromOverride(auth.refreshToken)
      : "";
    const refreshed = refreshedFromSession || refreshedFromOverride;
    if (refreshed) {
      res = await doFetch(refreshed);
    }
  }
  return res;
};

export async function claimTrainerInvite(code: string, auth?: AuthOverride) {
  const res = await authedPost("/functions/v1/claim-trainer-invite", { code }, auth);
  return await parseInviteApiResponse<{ status: "ok" }>(
    res,
    "Falha ao validar convite."
  );
}

export async function createTrainerInvite(options: {
  organizationId: string;
  role: TrainerInviteRole;
  invitedTo?: string;
}, auth?: AuthOverride) {
  const res = await authedPost("/functions/v1/create-trainer-invite", {
    organizationId: options.organizationId,
    role: options.role,
    invitedTo: options.invitedTo,
    invitedVia: "link",
    maxUses: 1,
  }, auth);
  return await parseInviteApiResponse<{
    code: string;
    signup_link: string;
    invite: TrainerInviteItem;
  }>(res, "Falha ao criar convite de membro.");
}

export async function listTrainerInvites(organizationId: string, auth?: AuthOverride) {
  const res = await authedPost("/functions/v1/list-trainer-invites", {
    organizationId,
  }, auth);
  return await parseInviteApiResponse<{ invites: TrainerInviteItem[] }>(
    res,
    "Falha ao listar convites de membro."
  );
}

export async function revokeTrainerInvite(
  inviteId: string,
  organizationId: string,
  auth?: AuthOverride
) {
  const res = await authedPost("/functions/v1/revoke-trainer-invite", {
    inviteId,
    organizationId,
  }, auth);
  return await parseInviteApiResponse<{ status: "ok" }>(
    res,
    "Falha ao cancelar convite de membro."
  );
}
