import { getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type AccessRequestReceipt = {
  accepted: boolean;
  status: "pending";
  organizationId: string | null;
};

export async function requestAccessReview(input: {
  organizationId?: string;
  coordinatorEmail?: string;
  requestedProduct?: "goatleta" | "goatleta_pro";
}): Promise<AccessRequestReceipt> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Sessão inválida. Entre novamente.");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/request-access-review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      organizationId: input.organizationId?.trim() || undefined,
      coordinatorEmail: input.coordinatorEmail?.trim().toLowerCase() || undefined,
      requestedProduct: input.requestedProduct ?? "goatleta",
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; accepted?: boolean; status?: "pending"; organizationId?: string | null }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível enviar a solicitação.");
  }
  return {
    accepted: payload?.accepted === true,
    status: payload?.status ?? "pending",
    organizationId: payload?.organizationId ?? input.organizationId ?? null,
  };
}
