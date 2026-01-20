import { SUPABASE_URL } from "./config";
import { getValidAccessToken } from "../auth/session";

export async function claimTrainerInvite(code: string) {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Missing auth token");
  }
  const base = SUPABASE_URL.replace(/\/$/, "");
  const res = await fetch(base + "/functions/v1/claim-trainer-invite", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || "Falha ao validar convite.");
  }
  return text ? JSON.parse(text) : {};
}
