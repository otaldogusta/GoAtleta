import { SUPABASE_URL } from "./config";
import { getValidAccessToken } from "../auth/session";

type CreateInviteOptions = {
  invitedVia?: string;
  invitedTo?: string;
};

type RevokeAccessOptions = {
  clearLoginEmail?: boolean;
};

type CreateInviteResponse = {
  token: string;
  expires_at?: string;
  student_id?: string;
};

const parseResponse = async (res: Response) => {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || "Falha ao processar convite.");
  }
  return text ? JSON.parse(text) : {};
};

export async function createStudentInvite(
  studentId: string,
  options?: CreateInviteOptions
) {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Missing auth token");
  }
  const base = SUPABASE_URL.replace(/\/$/, "");
  const res = await fetch(base + "/functions/v1/create-student-invite", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      studentId,
      invitedVia: options?.invitedVia,
      invitedTo: options?.invitedTo,
    }),
  });
  return (await parseResponse(res)) as CreateInviteResponse;
}

export async function revokeStudentAccess(
  studentId: string,
  options?: RevokeAccessOptions
) {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Missing auth token");
  }
  const base = SUPABASE_URL.replace(/\/$/, "");
  const res = await fetch(base + "/functions/v1/revoke-student-access", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      studentId,
      clearLoginEmail: options?.clearLoginEmail,
    }),
  });
  return parseResponse(res);
}

export async function claimStudentInvite(tokenValue: string) {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Missing auth token");
  }
  const base = SUPABASE_URL.replace(/\/$/, "");
  const res = await fetch(base + "/functions/v1/claim-student-invite", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: tokenValue }),
  });
  return parseResponse(res);
}
