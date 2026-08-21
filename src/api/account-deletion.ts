import { getValidAccessToken } from "../auth/session";
import { safeJsonParse } from "../utils/safe-json";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

type DeleteAccountResponse = {
  deleted?: boolean;
  code?: string;
  error?: string;
};

export const deleteMyAccount = async (confirmationText: string) => {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Sua sessão expirou. Entre novamente para excluir a conta.");
  }

  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/delete-account`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmationText }),
    },
  );
  const text = await response.text();
  const payload = safeJsonParse<DeleteAccountResponse | null>(text, null);

  if (!response.ok) {
    throw new Error(
      payload?.error || "Não foi possível excluir a conta. Tente novamente.",
    );
  }
  if (!payload?.deleted) {
    throw new Error("O servidor não confirmou a exclusão da conta.");
  }
};
