import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import { AUTH_REQUEST_TIMEOUT_MS } from "./session";

export const revokeAuthSession = async (accessToken: string): Promise<void> => {
  const token = accessToken.trim();
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/logout?scope=local`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      }
    );

    if (!response.ok && response.status !== 401) {
      throw new Error(`Supabase logout failed (${response.status}).`);
    }
  } finally {
    clearTimeout(timeoutHandle);
  }
};
