import { getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export async function requestAccessReview(coordinatorEmail: string): Promise<void> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Sessão inválida. Entre novamente.");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/request-access-review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ coordinatorEmail: coordinatorEmail.trim().toLowerCase() }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error || "Não foi possível enviar a solicitação.");
  }
}
