import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export async function updatePasswordWithAccessToken(
  accessToken: string,
  password: string
): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`,
    {
      method: "PUT",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Falha ao atualizar senha.");
  }
}
