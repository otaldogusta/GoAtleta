export type AsaasEnvironment = "sandbox" | "production";

export type AsaasListResponse<T> = {
  object?: string;
  hasMore?: boolean;
  totalCount?: number;
  limit?: number;
  offset?: number;
  data?: T[];
};

export type AsaasCustomer = {
  id?: string;
  name?: string;
  email?: string | null;
  additionalEmails?: string | null;
  cpfCnpj?: string | null;
  externalReference?: string | null;
  deleted?: boolean;
};

export type AsaasPayment = {
  id?: string;
  customer?: string;
  subscription?: string | null;
  externalReference?: string | null;
  status?: string;
  billingType?: string;
  value?: number;
  netValue?: number | null;
  dueDate?: string | null;
  paymentDate?: string | null;
  confirmedDate?: string | null;
  clientPaymentDate?: string | null;
};

export type AsaasSubscription = {
  id?: string;
  customer?: string;
  externalReference?: string | null;
  status?: string;
  billingType?: string;
  cycle?: string;
  value?: number;
  nextDueDate?: string | null;
};

export class AsaasApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AsaasApiError";
    this.status = status;
    this.code = code;
  }
}

const textValue = (value: unknown) => String(value ?? "").trim();

const asaasBaseUrl = (environment: AsaasEnvironment) =>
  environment === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

const parseErrorCode = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return "ASAAS_REQUEST_FAILED";
  const candidate = payload as {
    errors?: { code?: unknown }[];
    code?: unknown;
  };
  return (
    textValue(candidate.errors?.[0]?.code ?? candidate.code)
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .slice(0, 80) || "ASAAS_REQUEST_FAILED"
  );
};

const parseErrorMessage = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return "Não foi possível consultar o Asaas.";
  }
  const candidate = payload as {
    errors?: { description?: unknown }[];
    error?: unknown;
    message?: unknown;
  };
  return (
    textValue(
      candidate.errors?.[0]?.description ??
        candidate.error ??
        candidate.message,
    ).slice(0, 240) || "Não foi possível consultar o Asaas."
  );
};

export function validateAsaasApiKey(value: string) {
  const normalized = textValue(value);
  if (
    normalized.length < 20 ||
    normalized.length > 512 ||
    /\s/.test(normalized)
  ) {
    throw new Error("asaas_api_key_invalid");
  }
  return normalized;
}

const environmentFromKeyPrefix = (apiKey: string): AsaasEnvironment | null => {
  if (apiKey.startsWith("$aact_hmlg_")) return "sandbox";
  if (apiKey.startsWith("$aact_prod_")) return "production";
  return null;
};

export async function asaasRequest<T>(params: {
  apiKey: string;
  environment: AsaasEnvironment;
  pathname: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  fetcher?: typeof fetch;
}): Promise<T> {
  const apiKey = validateAsaasApiKey(params.apiKey);
  const pathname = params.pathname.startsWith("/")
    ? params.pathname
    : `/${params.pathname}`;
  const response = await (params.fetcher ?? fetch)(
    `${asaasBaseUrl(params.environment)}${pathname}`,
    {
      method: params.method ?? "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "GoAtleta/1.0 (receivables-connector)",
        access_token: apiKey,
        ...(params.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: params.body === undefined ? undefined : JSON.stringify(params.body),
      signal: AbortSignal.timeout(20_000),
    },
  );

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    throw new AsaasApiError(
      response.status,
      parseErrorCode(payload),
      parseErrorMessage(payload),
    );
  }
  return payload as T;
}

export async function detectAsaasEnvironment(params: {
  apiKey: string;
  fetcher?: typeof fetch;
}): Promise<AsaasEnvironment> {
  const apiKey = validateAsaasApiKey(params.apiKey);
  const prefixedEnvironment = environmentFromKeyPrefix(apiKey);
  if (prefixedEnvironment) return prefixedEnvironment;

  let lastAuthError: AsaasApiError | null = null;
  for (const environment of ["production", "sandbox"] as const) {
    try {
      await asaasRequest({
        apiKey,
        environment,
        pathname: "/myAccount/status/",
        fetcher: params.fetcher,
      });
      return environment;
    } catch (error) {
      if (error instanceof AsaasApiError && error.status === 401) {
        lastAuthError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastAuthError ?? new Error("asaas_environment_not_detected");
}

const walletIdFromPayload = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return textValue((payload[0] as { id?: unknown } | undefined)?.id);
  }
  if (payload && typeof payload === "object") {
    const candidate = payload as {
      id?: unknown;
      walletId?: unknown;
      data?: { id?: unknown }[];
    };
    return textValue(
      candidate.walletId ?? candidate.id ?? candidate.data?.[0]?.id,
    );
  }
  return "";
};

export async function validateAsaasConnection(params: {
  apiKey: string;
  environment: AsaasEnvironment;
  fetcher?: typeof fetch;
}) {
  const request = <T>(pathname: string) =>
    asaasRequest<T>({ ...params, pathname });
  const [status, wallets, customers, payments, subscriptions] =
    await Promise.all([
      request<{ general?: string }>("/myAccount/status/"),
      request<unknown>("/wallets/"),
      request<AsaasListResponse<AsaasCustomer>>("/customers?limit=1&offset=0"),
      request<AsaasListResponse<AsaasPayment>>("/payments?limit=1&offset=0"),
      request<AsaasListResponse<AsaasSubscription>>(
        "/subscriptions?limit=1&offset=0",
      ),
    ]);
  const walletId = walletIdFromPayload(wallets);
  if (!walletId) throw new Error("asaas_wallet_missing");
  return {
    walletId,
    accountStatus: textValue(status.general).toUpperCase() || "PENDING",
    customerCount: Math.max(0, Number(customers.totalCount ?? 0) || 0),
    paymentCount: Math.max(0, Number(payments.totalCount ?? 0) || 0),
    subscriptionCount: Math.max(0, Number(subscriptions.totalCount ?? 0) || 0),
  };
}

export async function listAllAsaas<T>(params: {
  apiKey: string;
  environment: AsaasEnvironment;
  resource: "customers" | "payments" | "subscriptions";
  maxPages?: number;
  fetcher?: typeof fetch;
}) {
  const limit = 100;
  const maxPages = Math.max(1, Math.min(params.maxPages ?? 50, 100));
  const records: T[] = [];
  let totalCount = 0;
  let truncated = false;

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * limit;
    const payload = await asaasRequest<AsaasListResponse<T>>({
      ...params,
      pathname: `/${params.resource}?limit=${limit}&offset=${offset}`,
    });
    const data = Array.isArray(payload.data) ? payload.data : [];
    records.push(...data);
    totalCount = Math.max(totalCount, Number(payload.totalCount ?? 0) || 0);
    const hasMore = payload.hasMore === true || records.length < totalCount;
    if (!hasMore || data.length === 0) {
      truncated = false;
      return {
        records,
        totalCount: Math.max(totalCount, records.length),
        truncated,
      };
    }
    truncated = page === maxPages - 1;
  }

  return {
    records,
    totalCount: Math.max(totalCount, records.length),
    truncated,
  };
}

export async function createAsaasWebhook(params: {
  apiKey: string;
  environment: AsaasEnvironment;
  url: string;
  email: string;
  authToken: string;
  fetcher?: typeof fetch;
}) {
  const payload = await asaasRequest<{ id?: string }>({
    ...params,
    pathname: "/webhooks",
    method: "POST",
    body: {
      name: "Go Atleta - recebimentos",
      url: params.url,
      email: params.email,
      enabled: true,
      interrupted: false,
      authToken: params.authToken,
      sendType: "SEQUENTIALLY",
      events: [
        "PAYMENT_CREATED",
        "PAYMENT_UPDATED",
        "PAYMENT_CONFIRMED",
        "PAYMENT_RECEIVED",
        "PAYMENT_OVERDUE",
        "PAYMENT_DELETED",
        "PAYMENT_RESTORED",
        "PAYMENT_REFUNDED",
        "PAYMENT_PARTIALLY_REFUNDED",
        "PAYMENT_CHARGEBACK_REQUESTED",
        "PAYMENT_CHARGEBACK_DISPUTE",
        "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
        "PAYMENT_DUNNING_RECEIVED",
        "PAYMENT_DUNNING_REQUESTED",
        "SUBSCRIPTION_CREATED",
        "SUBSCRIPTION_UPDATED",
        "SUBSCRIPTION_INACTIVATED",
        "SUBSCRIPTION_DELETED",
      ],
    },
  });
  const id = textValue(payload.id);
  if (!id) throw new Error("asaas_webhook_id_missing");
  return id;
}

export async function deleteAsaasWebhook(params: {
  apiKey: string;
  environment: AsaasEnvironment;
  webhookId: string;
  fetcher?: typeof fetch;
}) {
  const webhookId = encodeURIComponent(textValue(params.webhookId));
  if (!webhookId) return false;
  await asaasRequest<unknown>({
    ...params,
    pathname: `/webhooks/${webhookId}`,
    method: "DELETE",
  });
  return true;
}
