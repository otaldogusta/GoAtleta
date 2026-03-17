import { forceRefreshAccessToken, getValidAccessToken } from "../auth/session";
import { SUPABASE_URL } from "./config";
import { parseInviteApiResponse } from "./invite-errors";

type CreateInviteOptions = {
  invitedVia: string;
  invitedTo: string;
};

type RevokeAccessOptions = {
  clearLoginEmail: boolean;
};

type CreateInviteResponse = {
  token: string;
  expires_at: string;
  student_id: string;
};

export type StudentInvitePendingItem = {
  id: string;
  student_id: string;
  student_name: string;
  created_at: string;
  expires_at: string | null;
  invited_via: string;
  invited_to: string | null;
};

const baseUrl = SUPABASE_URL.replace(/\/$/, "");

const requestWithAuth = async (path: string, body: Record<string, unknown>) => {
  const waitForAccessToken = async (): Promise<string> => {
    let token = await getValidAccessToken();
    if (token) return token;

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
    fetch(baseUrl + path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshed = await forceRefreshAccessToken();
    if (refreshed) {
      res = await doFetch(refreshed);
    }
  }
  return res;
};

export async function createStudentInvite(
  studentId: string,
  options: CreateInviteOptions
) {
  const res = await requestWithAuth("/functions/v1/create-student-invite", {
    studentId,
    invitedVia: options.invitedVia,
    invitedTo: options.invitedTo,
  });
  return await parseInviteApiResponse<CreateInviteResponse>(
    res,
    "Falha ao criar convite de aluno."
  );
}

export async function revokeStudentAccess(
  studentId: string,
  options: RevokeAccessOptions
) {
  const res = await requestWithAuth("/functions/v1/revoke-student-access", {
    studentId,
    clearLoginEmail: options.clearLoginEmail,
  });
  return await parseInviteApiResponse<{ status: "ok" }>(
    res,
    "Falha ao revogar acesso do aluno."
  );
}

export async function claimStudentInvite(tokenValue: string) {
  const res = await requestWithAuth("/functions/v1/claim-student-invite", {
    token: tokenValue,
  });
  return await parseInviteApiResponse<{ status: "ok"; student_id: string }>(
    res,
    "Falha ao validar convite de aluno."
  );
}

export async function listStudentPendingInvites() {
  const res = await requestWithAuth("/functions/v1/list-student-invites", {});
  return await parseInviteApiResponse<{ invites: StudentInvitePendingItem[] }>(
    res,
    "Falha ao listar convites de aluno."
  );
}

export async function revokeStudentInvite(inviteId: string) {
  const res = await requestWithAuth("/functions/v1/revoke-student-invite", {
    inviteId,
  });
  return await parseInviteApiResponse<{ status: "ok" }>(
    res,
    "Falha ao cancelar convite de aluno."
  );
}
