import { getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type StoredWebPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

const callRegistrationFunction = async (
  organizationId: string,
  action: "subscribe" | "unsubscribe",
  subscription: StoredWebPushSubscription,
) => {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Sessão inválida. Faça login novamente.");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/register-web-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      action,
      organizationId,
      ...subscription,
      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    }),
  });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível atualizar a inscrição web push.");
  }
};

export const registerWebPushSubscription = (
  organizationId: string,
  subscription: StoredWebPushSubscription,
) => callRegistrationFunction(organizationId, "subscribe", subscription);

export const unregisterWebPushSubscription = (
  organizationId: string,
  subscription: StoredWebPushSubscription,
) => callRegistrationFunction(organizationId, "unsubscribe", subscription);
