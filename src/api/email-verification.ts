import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { safeJsonParse } from "../utils/safe-json";

type VerificationResponse = Record<string, unknown>;

export const verifySignupEmailCode = async (
  email: string,
  code: string
): Promise<VerificationResponse> => {
  const res = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/verify-signup-email-code`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, code }),
    }
  );
  const text = await res.text();
  const payload = safeJsonParse<Record<string, unknown> | null>(text, null);
  if (!res.ok) {
    const detail =
      String(payload?.error ?? payload?.message ?? payload?.code ?? text).trim() ||
      "Falha ao confirmar o e-mail.";
    throw new Error(detail);
  }
  if (!payload || typeof payload.access_token !== "string") {
    throw new Error("Resposta inválida ao confirmar o e-mail.");
  }
  return payload;
};
