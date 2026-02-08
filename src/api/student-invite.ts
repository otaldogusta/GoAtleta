import { SUPABASE_URL } from "./config";
import { forceRefreshAccessToken, getValidAccessToken } from "../auth/session";

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

const baseUrl = SUPABASE_URL.replace(/\/$/, "");

const parseResponse = async (res: Response) => {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || "Falha ao processar convite.");
  }
  return text ? JSON.parse(text) : {};
};

const requestWithAuth = async (path: string, body: Record<string, unknown>) => {
  const token = await getValidAccessToken();
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
  return (await parseResponse(res)) as CreateInviteResponse;
}

export async function revokeStudentAccess(
  studentId: string,
  options: RevokeAccessOptions
) {
  const res = await requestWithAuth("/functions/v1/revoke-student-access", {
    studentId,
    clearLoginEmail: options.clearLoginEmail,
  });
  return parseResponse(res);
}

export async function claimStudentInvite(tokenValue: string) {
  const res = await requestWithAuth("/functions/v1/claim-student-invite", {
    token: tokenValue,
  });
  return parseResponse(res);
}
