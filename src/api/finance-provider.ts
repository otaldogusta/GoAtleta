import { forceRefreshAccessToken, getValidAccessToken } from "../auth/session";
import { safeJsonParse } from "../utils/safe-json";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type FinanceProviderEnvironment = "sandbox" | "production";
export type FinanceProviderWebhookStatus =
  "not_configured" | "configured" | "error";

export type FinanceProviderSyncSummary = {
  customerCount: number;
  matchedCustomerCount: number;
  ambiguousCustomerCount: number;
  paymentCount: number;
  subscriptionCount: number;
  truncated: boolean;
  completedAt: string | null;
};

export type FinanceProviderConnection = {
  provider: "asaas";
  environment: FinanceProviderEnvironment;
  mode: "read_only" | "active";
  merchantStatus: "pending" | "active" | "restricted" | "disconnected";
  accountStatus: string;
  keyHint: string;
  webhookStatus: FinanceProviderWebhookStatus;
  lastVerifiedAt: string | null;
  lastSyncAt: string | null;
  chargesEnabled: boolean;
  sync: FinanceProviderSyncSummary | null;
};

export type FinanceProviderConnectionStatus = {
  status: "connected" | "not_connected";
  canManageConnection: boolean;
  connection: FinanceProviderConnection | null;
  receipt?: {
    action: string;
    readOnly?: boolean;
    providerWebhookRemoved?: boolean;
    historyPreserved?: boolean;
    discovered?: {
      customerCount: number;
      paymentCount: number;
      subscriptionCount: number;
    };
  };
};

type FinanceProviderAction =
  | "status"
  | "connect"
  | "rotate_key"
  | "verify"
  | "sync"
  | "provision_webhook"
  | "disconnect";

const ENDPOINT = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/finance-provider-connection`;

const waitForAccessToken = async () => {
  let token = await getValidAccessToken();
  if (token) return token;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    token = await getValidAccessToken();
    if (token) return token;
  }
  return "";
};

const execute = (token: string, body: Record<string, unknown>) =>
  fetch(ENDPOINT, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

const parseResponse = async (response: Response) => {
  const text = await response.text();
  const payload = safeJsonParse<Record<string, unknown>>(text, {});
  if (!response.ok) {
    const message = String(payload.error ?? "").trim();
    throw new Error(
      message || "Não foi possível acessar o conector financeiro.",
    );
  }
  return payload as FinanceProviderConnectionStatus;
};

const request = async (
  action: FinanceProviderAction,
  organizationId: string,
  extra: Record<string, unknown> = {},
) => {
  if (!organizationId.trim()) throw new Error("Instituição não selecionada.");
  const token = await waitForAccessToken();
  if (!token) throw new Error("Sessão não encontrada.");
  let response = await execute(token, {
    action,
    organizationId,
    ...extra,
  });
  if (response.status === 401) {
    const refreshed = await forceRefreshAccessToken();
    if (refreshed) {
      response = await execute(refreshed, {
        action,
        organizationId,
        ...extra,
      });
    }
  }
  return parseResponse(response);
};

export const getFinanceProviderConnection = (organizationId: string) =>
  request("status", organizationId);

export const connectFinanceProvider = (input: {
  organizationId: string;
  apiKey: string;
}) =>
  request("connect", input.organizationId, {
    apiKey: input.apiKey,
  });

export const rotateFinanceProviderKey = (input: {
  organizationId: string;
  apiKey: string;
}) =>
  request("rotate_key", input.organizationId, {
    apiKey: input.apiKey,
  });

export const verifyFinanceProviderConnection = (organizationId: string) =>
  request("verify", organizationId);

export const syncFinanceProviderHistory = (organizationId: string) =>
  request("sync", organizationId);

export const provisionFinanceProviderWebhook = (organizationId: string) =>
  request("provision_webhook", organizationId);

export const disconnectFinanceProvider = (organizationId: string) =>
  request("disconnect", organizationId);
