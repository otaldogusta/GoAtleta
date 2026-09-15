import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export async function getGoogleLinkUrl(accessToken: string, redirectTo: string): Promise<string> {
  if (!accessToken) throw new Error("Entre novamente para conectar o Google.");
  const query = new URLSearchParams({
    provider: "google", redirect_to: redirectTo, skip_http_redirect: "true", prompt: "select_account",
  });
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user/identities/authorize?${query}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok || typeof data?.url !== "string") {
    throw new Error("Não foi possível conectar o Google. Tente novamente.");
  }
  const url = new URL(data.url);
  if (url.protocol !== "https:" || url.hostname !== "accounts.google.com") {
    throw new Error("Endereço de conexão inválido.");
  }
  return url.href;
}
