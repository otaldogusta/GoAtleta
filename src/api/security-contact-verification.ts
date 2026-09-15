import { getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type SecurityContactStatus = {
  email: string | null;
  verifiedAt: string | null;
  pendingEmail: string | null;
  retryAt: string | null;
};
export async function securityContactVerification(action: "status" | "request" | "verify" | "remove", email?: string, code?: string): Promise<SecurityContactStatus> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Entre novamente para continuar.");
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/security-contact-verification`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action, email, code }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.error) throw new Error(body?.error || "Não foi possível consultar o e-mail alternativo.");
  return body;
}
