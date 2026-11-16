import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { safeJsonParse } from "../utils/safe-json";

type VerificationResponse = Record<string, unknown>;

const callSignupEmailCorrection = async (accessToken: string, email: string, code?: string) => {
  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/correct-signup-email`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, code }),
    },
  );
  const payload = safeJsonParse<{
    session?: VerificationResponse;
    deliveryFailed?: boolean;
    error?: string;
  } | null>(await response.text(), null);
  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível enviar o código para esse e-mail.");
  }
  return payload;
};

export const requestSignupEmailCorrection = async (accessToken: string, email: string) => {
  const payload = await callSignupEmailCorrection(accessToken, email);
  if (typeof payload?.deliveryFailed !== "boolean") {
    throw new Error("Resposta inválida ao corrigir o e-mail.");
  }
  return { deliveryFailed: payload.deliveryFailed };
};

export const verifySignupEmailCorrection = async (accessToken: string, email: string, code: string) => {
  const payload = await callSignupEmailCorrection(accessToken, email, code);
  if (typeof payload?.session?.access_token !== "string") {
    throw new Error("Resposta inválida ao confirmar o e-mail.");
  }
  return payload.session;
};

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
