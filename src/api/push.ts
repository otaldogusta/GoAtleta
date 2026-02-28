import { getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type SendPushInput = {
  organizationId: string;
  targetUserId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type SendPushResult = {
  status: "ok" | "partial" | "error";
  sent: number;
  failed: number;
  invalidTokens: number;
};

export async function sendPushToUser(input: SendPushInput): Promise<SendPushResult> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      organizationId: input.organizationId,
      targetUserId: input.targetUserId,
      title: input.title,
      body: input.body,
      data: input.data ?? null,
    }),
  });

  const raw = await response.text();
  const parsed = raw ? (JSON.parse(raw) as { error?: string } & Partial<SendPushResult>) : null;
  if (!response.ok) {
    throw new Error(parsed?.error || "Falha ao enviar notificação push.");
  }
  return {
    status: parsed?.status ?? "error",
    sent: Number(parsed?.sent ?? 0),
    failed: Number(parsed?.failed ?? 0),
    invalidTokens: Number(parsed?.invalidTokens ?? 0),
  };
}

