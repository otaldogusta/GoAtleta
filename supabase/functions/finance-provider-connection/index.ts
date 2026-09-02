import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import {
  AsaasApiError,
  createAsaasWebhook,
  deleteAsaasWebhook,
  detectAsaasEnvironment,
  listAllAsaas,
  validateAsaasApiKey,
  validateAsaasConnection,
  type AsaasCustomer,
  type AsaasEnvironment,
  type AsaasPayment,
  type AsaasSubscription,
} from "../_shared/asaas-client.ts";
import {
  isUsableAsaasCustomer,
  isUsableAsaasPayment,
  isUsableAsaasSubscription,
  mapAsaasCustomerRecord,
  mapAsaasPaymentRecord,
  mapAsaasSubscriptionRecord,
  matchStatusForCount,
  providerEmailCandidates,
  type ProviderMatchStatus,
} from "../_shared/asaas-sync.ts";
import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/middlewares/auth.ts";
import {
  createSecureWebhookToken,
  decryptProviderSecret,
  encryptProviderSecret,
  providerSecretContext,
  sha256Hex,
} from "../_shared/provider-secret.ts";

type ConnectionAction =
  | "status"
  | "connect"
  | "rotate_key"
  | "verify"
  | "sync"
  | "provision_webhook"
  | "disconnect";

type ConnectionRequest = {
  action?: unknown;
  organizationId?: unknown;
  apiKey?: unknown;
};

type CredentialRow = {
  environment?: unknown;
  secret_ciphertext?: unknown;
  secret_iv?: unknown;
  key_hint?: unknown;
};

type MerchantRow = {
  id?: unknown;
  external_account_id?: unknown;
  status?: unknown;
  environment?: unknown;
  connection_mode?: unknown;
  key_hint?: unknown;
  account_status?: unknown;
  webhook_id?: unknown;
  webhook_status?: unknown;
  last_verified_at?: unknown;
  last_sync_at?: unknown;
  charges_enabled?: unknown;
};

type SyncRunRow = {
  customer_count?: unknown;
  matched_customer_count?: unknown;
  ambiguous_customer_count?: unknown;
  payment_count?: unknown;
  subscription_count?: unknown;
  truncated?: unknown;
  completed_at?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDER = "asaas";
const MAX_UPSERT_ROWS = 250;

const textValue = (value: unknown) => String(value ?? "").trim();
const integerValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

const jsonHeaders = (req: Request) => ({
  ...buildCorsHeaders(req),
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
});

const json = (req: Request, status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders(req),
  });

const resolveSecretKey = () => {
  const legacy = textValue(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(
      textValue(Deno.env.get("SUPABASE_SECRET_KEYS")) || "{}",
    ) as Record<string, unknown>;
    return textValue(keys.default);
  } catch {
    return "";
  }
};

const adminClient = () => {
  const url = textValue(Deno.env.get("SUPABASE_URL"));
  const key = resolveSecretKey();
  if (!url || !key) throw new Error("supabase_not_configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const parseEnvironment = (value: unknown): AsaasEnvironment | null => {
  const normalized = textValue(value).toLowerCase();
  return normalized === "sandbox" || normalized === "production"
    ? normalized
    : null;
};

const safeErrorCode = (error: unknown) => {
  if (error instanceof AsaasApiError) return error.code;
  return (
    (error instanceof Error ? error.message : "provider_request_failed")
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .slice(0, 120) || "provider_request_failed"
  );
};

const userError = (error: unknown) => {
  if (error instanceof AsaasApiError) {
    if (error.status === 401) {
      return {
        status: 401,
        code: "ASAAS_KEY_REJECTED",
        error: "A chave foi recusada pelo Asaas.",
      };
    }
    if (error.status === 403) {
      return {
        status: 403,
        code: "ASAAS_ACCESS_RESTRICTED",
        error: "A chave não possui acesso suficiente para esta operação.",
      };
    }
    return {
      status: 502,
      code: "ASAAS_UNAVAILABLE",
      error: "O Asaas não concluiu a solicitação. Tente novamente.",
    };
  }
  const code = safeErrorCode(error);
  if (code.includes("encryption_not_configured")) {
    return {
      status: 503,
      code: "CONNECTOR_SECRET_NOT_CONFIGURED",
      error: "O cofre do conector ainda não foi configurado.",
    };
  }
  if (code.includes("api_key_invalid")) {
    return {
      status: 400,
      code: "ASAAS_KEY_INVALID",
      error: "Informe uma chave Asaas válida.",
    };
  }
  if (code.includes("ACCOUNT_MISMATCH")) {
    return {
      status: 409,
      code: "ASAAS_ACCOUNT_MISMATCH",
      error:
        "A nova chave pertence a outra conta Asaas. Remova a conexão atual antes de trocar de conta.",
    };
  }
  if (code.includes("webhook_server_not_configured")) {
    return {
      status: 503,
      code: "ASAAS_WEBHOOK_NOT_CONFIGURED",
      error: "O endereço seguro do webhook ainda não foi configurado.",
    };
  }
  if (
    code.includes("ALREADY_CONNECTED") ||
    code.includes("already_connected")
  ) {
    return {
      status: 409,
      code: "ASAAS_ALREADY_CONNECTED",
      error: "A instituição já possui uma conexão Asaas.",
    };
  }
  return {
    status: 500,
    code: "CONNECTOR_ERROR",
    error: "Não foi possível concluir a operação do conector.",
  };
};

const getAccess = async (
  admin: ReturnType<typeof adminClient>,
  organizationId: string,
  userId: string,
) => {
  const [{ data: membership }, { data: financialPermission }] =
    await Promise.all([
      admin
        .from("organization_members")
        .select("role_level")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("organization_member_permissions")
        .select("is_allowed")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .eq("permission_key", "financial")
        .maybeSingle(),
    ]);
  const roleLevel = Number(membership?.role_level ?? 0);
  const canManage = roleLevel >= 50;
  return {
    canRead: canManage || financialPermission?.is_allowed === true,
    canManage,
  };
};

const readCredential = async (
  admin: ReturnType<typeof adminClient>,
  organizationId: string,
) => {
  const { data, error } = await admin
    .from("payment_provider_credentials")
    .select("environment,secret_ciphertext,secret_iv,key_hint")
    .eq("organization_id", organizationId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (error) throw new Error("provider_credential_read_failed");
  return (data ?? null) as CredentialRow | null;
};

const decryptApiKey = async (
  organizationId: string,
  credential: CredentialRow,
) => {
  const environment = parseEnvironment(credential.environment);
  if (!environment) throw new Error("provider_environment_invalid");
  const masterSecret = textValue(
    Deno.env.get("PAYMENT_PROVIDER_ENCRYPTION_KEY"),
  );
  const context = providerSecretContext({
    organizationId,
    provider: PROVIDER,
    environment,
  });
  const apiKey = await decryptProviderSecret({
    ciphertext: textValue(credential.secret_ciphertext),
    iv: textValue(credential.secret_iv),
    masterSecret,
    context,
  });
  return { apiKey, environment };
};

const latestSync = async (
  admin: ReturnType<typeof adminClient>,
  organizationId: string,
) => {
  const { data } = await admin
    .from("finance_provider_sync_runs")
    .select(
      "customer_count,matched_customer_count,ambiguous_customer_count,payment_count,subscription_count,truncated,completed_at",
    )
    .eq("organization_id", organizationId)
    .eq("provider", PROVIDER)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as SyncRunRow | null;
};

const connectionStatus = async (params: {
  admin: ReturnType<typeof adminClient>;
  organizationId: string;
  canManage: boolean;
}) => {
  const [{ data: merchant }, credential, sync] = await Promise.all([
    params.admin
      .from("merchant_accounts")
      .select(
        "id,status,environment,connection_mode,key_hint,account_status,webhook_id,webhook_status,last_verified_at,last_sync_at,charges_enabled",
      )
      .eq("organization_id", params.organizationId)
      .eq("provider", PROVIDER)
      .maybeSingle(),
    readCredential(params.admin, params.organizationId),
    latestSync(params.admin, params.organizationId),
  ]);
  const safeMerchant = (merchant ?? null) as MerchantRow | null;
  const connected = Boolean(credential && safeMerchant?.id);
  return {
    status: connected ? "connected" : "not_connected",
    canManageConnection: params.canManage,
    connection: connected
      ? {
          provider: PROVIDER,
          environment: textValue(safeMerchant?.environment),
          mode: textValue(safeMerchant?.connection_mode) || "read_only",
          merchantStatus: textValue(safeMerchant?.status) || "pending",
          accountStatus: textValue(safeMerchant?.account_status) || "PENDING",
          keyHint: textValue(safeMerchant?.key_hint),
          webhookStatus:
            textValue(safeMerchant?.webhook_status) || "not_configured",
          lastVerifiedAt: textValue(safeMerchant?.last_verified_at) || null,
          lastSyncAt: textValue(safeMerchant?.last_sync_at) || null,
          chargesEnabled: safeMerchant?.charges_enabled === true,
          sync: sync
            ? {
                customerCount: integerValue(sync.customer_count),
                matchedCustomerCount: integerValue(sync.matched_customer_count),
                ambiguousCustomerCount: integerValue(
                  sync.ambiguous_customer_count,
                ),
                paymentCount: integerValue(sync.payment_count),
                subscriptionCount: integerValue(sync.subscription_count),
                truncated: sync.truncated === true,
                completedAt: textValue(sync.completed_at) || null,
              }
            : null,
        }
      : null,
  };
};

const chunks = <T>(values: T[], size = MAX_UPSERT_ROWS) => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

const upsertRows = async (params: {
  admin: ReturnType<typeof adminClient>;
  table: string;
  rows: Record<string, unknown>[];
  onConflict: string;
}) => {
  for (const batch of chunks(params.rows)) {
    if (batch.length === 0) continue;
    const { error } = await params.admin
      .from(params.table)
      .upsert(batch, { onConflict: params.onConflict });
    if (error) throw new Error(`${params.table}_upsert_failed`);
  }
};

const findInvoiceIds = async (
  admin: ReturnType<typeof adminClient>,
  organizationId: string,
  payments: AsaasPayment[],
) => {
  const candidates = Array.from(
    new Set(
      payments
        .map((payment) => textValue(payment.externalReference))
        .filter((value) => UUID_PATTERN.test(value)),
    ),
  );
  const found = new Set<string>();
  for (const batch of chunks(candidates, 100)) {
    if (batch.length === 0) continue;
    const { data, error } = await admin
      .from("invoices")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", batch);
    if (error) throw new Error("provider_invoice_match_failed");
    for (const row of data ?? []) found.add(textValue(row.id));
  }
  return found;
};

const syncHistory = async (params: {
  admin: ReturnType<typeof adminClient>;
  organizationId: string;
  userId: string;
  apiKey: string;
  environment: AsaasEnvironment;
}) => {
  const { data: run, error: runError } = await params.admin
    .from("finance_provider_sync_runs")
    .insert({
      organization_id: params.organizationId,
      provider: PROVIDER,
      environment: params.environment,
      status: "running",
      started_by: params.userId,
    })
    .select("id")
    .single();
  if (runError || !run?.id) throw new Error("provider_sync_run_start_failed");
  const runId = textValue(run.id);

  try {
    const [customerResult, paymentResult, subscriptionResult, relationships] =
      await Promise.all([
        listAllAsaas<AsaasCustomer>({
          apiKey: params.apiKey,
          environment: params.environment,
          resource: "customers",
        }),
        listAllAsaas<AsaasPayment>({
          apiKey: params.apiKey,
          environment: params.environment,
          resource: "payments",
        }),
        listAllAsaas<AsaasSubscription>({
          apiKey: params.apiKey,
          environment: params.environment,
          resource: "subscriptions",
        }),
        params.admin
          .from("student_relationships")
          .select("id,contact_email")
          .eq("organization_id", params.organizationId)
          .eq("status", "active")
          .or("can_pay.eq.true,can_view_financial.eq.true"),
      ]);
    if (relationships.error) {
      throw new Error("provider_relationship_match_failed");
    }

    const relationshipIdsByEmail = new Map<string, Set<string>>();
    for (const relationship of relationships.data ?? []) {
      const email = textValue(relationship.contact_email).toLowerCase();
      const id = textValue(relationship.id);
      if (!email || !id) continue;
      const values = relationshipIdsByEmail.get(email) ?? new Set<string>();
      values.add(id);
      relationshipIdsByEmail.set(email, values);
    }

    const customers = customerResult.records.filter(isUsableAsaasCustomer);
    const matchesByCustomer = new Map<string, string[]>();
    const statusByCustomer = new Map<string, ProviderMatchStatus>();
    const customerRows = customers.map((customer) => {
      const matches = new Set<string>();
      for (const email of providerEmailCandidates(customer)) {
        for (const id of relationshipIdsByEmail.get(email) ?? []) {
          matches.add(id);
        }
      }
      const externalId = textValue(customer.id);
      const matchIds = Array.from(matches);
      const matchStatus = matchStatusForCount(matchIds.length);
      matchesByCustomer.set(externalId, matchIds);
      statusByCustomer.set(externalId, matchStatus);
      return mapAsaasCustomerRecord({
        organizationId: params.organizationId,
        customer,
        matchStatus,
      });
    });
    await upsertRows({
      admin: params.admin,
      table: "provider_customers",
      rows: customerRows,
      onConflict: "organization_id,provider,external_customer_id",
    });

    const providerCustomerIds = new Map<string, string>();
    for (const batch of chunks(Array.from(matchesByCustomer.keys()), 100)) {
      if (batch.length === 0) continue;
      const { data, error } = await params.admin
        .from("provider_customers")
        .select("id,external_customer_id")
        .eq("organization_id", params.organizationId)
        .eq("provider", PROVIDER)
        .in("external_customer_id", batch);
      if (error) throw new Error("provider_customer_link_read_failed");
      for (const row of data ?? []) {
        providerCustomerIds.set(
          textValue(row.external_customer_id),
          textValue(row.id),
        );
      }
    }

    for (const batch of chunks(Array.from(providerCustomerIds.values()), 100)) {
      if (batch.length === 0) continue;
      const { error } = await params.admin
        .from("provider_customer_relationship_links")
        .delete()
        .eq("organization_id", params.organizationId)
        .eq("match_basis", "exact_email")
        .in("provider_customer_id", batch);
      if (error) throw new Error("provider_customer_link_cleanup_failed");
    }
    const linkRows: Record<string, unknown>[] = [];
    for (const [externalId, relationshipIds] of matchesByCustomer) {
      if (relationshipIds.length !== 1) continue;
      const providerCustomerId = providerCustomerIds.get(externalId);
      if (!providerCustomerId) continue;
      for (const relationshipId of relationshipIds) {
        linkRows.push({
          organization_id: params.organizationId,
          provider_customer_id: providerCustomerId,
          payer_relationship_id: relationshipId,
          match_basis: "exact_email",
          created_by: params.userId,
        });
      }
    }
    await upsertRows({
      admin: params.admin,
      table: "provider_customer_relationship_links",
      rows: linkRows,
      onConflict: "provider_customer_id,payer_relationship_id",
    });

    const payments = paymentResult.records.filter(isUsableAsaasPayment);
    const invoiceIds = await findInvoiceIds(
      params.admin,
      params.organizationId,
      payments,
    );
    const paymentRows = payments.map((payment) => {
      const customerId = textValue(payment.customer);
      const externalReference = textValue(payment.externalReference);
      const linkedInvoice = invoiceIds.has(externalReference)
        ? externalReference
        : null;
      const matchStatus = linkedInvoice
        ? "matched"
        : (statusByCustomer.get(customerId) ?? "unmatched");
      return mapAsaasPaymentRecord({
        organizationId: params.organizationId,
        payment,
        matchStatus,
        invoiceId: linkedInvoice,
      });
    });
    await upsertRows({
      admin: params.admin,
      table: "provider_receivables",
      rows: paymentRows,
      onConflict: "organization_id,provider,external_payment_id",
    });

    const subscriptions = subscriptionResult.records.filter(
      isUsableAsaasSubscription,
    );
    const subscriptionRows = subscriptions.map((subscription) =>
      mapAsaasSubscriptionRecord({
        organizationId: params.organizationId,
        subscription,
        matchStatus:
          statusByCustomer.get(textValue(subscription.customer)) ?? "unmatched",
      }),
    );
    await upsertRows({
      admin: params.admin,
      table: "provider_subscriptions",
      rows: subscriptionRows,
      onConflict: "organization_id,provider,external_subscription_id",
    });

    const matchedCustomerCount = Array.from(statusByCustomer.values()).filter(
      (status) => status === "matched",
    ).length;
    const ambiguousCustomerCount = Array.from(statusByCustomer.values()).filter(
      (status) => status === "ambiguous",
    ).length;
    const truncated =
      customerResult.truncated ||
      paymentResult.truncated ||
      subscriptionResult.truncated;
    const completedAt = new Date().toISOString();
    const { error: finishError } = await params.admin
      .from("finance_provider_sync_runs")
      .update({
        status: "completed",
        customer_count: customers.length,
        matched_customer_count: matchedCustomerCount,
        ambiguous_customer_count: ambiguousCustomerCount,
        payment_count: payments.length,
        subscription_count: subscriptions.length,
        truncated,
        completed_at: completedAt,
      })
      .eq("id", runId)
      .eq("organization_id", params.organizationId);
    if (finishError) throw new Error("provider_sync_run_finish_failed");

    const { data: merchant } = await params.admin
      .from("merchant_accounts")
      .update({
        last_sync_at: completedAt,
        sync_error_code: null,
      })
      .eq("organization_id", params.organizationId)
      .eq("provider", PROVIDER)
      .select("id")
      .single();
    if (merchant?.id) {
      await params.admin.from("finance_audit_events").insert({
        organization_id: params.organizationId,
        entity_type: "merchant_account",
        entity_id: merchant.id,
        action: "provider_history_synchronized",
        actor_user_id: params.userId,
        after_state: {
          provider: PROVIDER,
          environment: params.environment,
          customerCount: customers.length,
          paymentCount: payments.length,
          subscriptionCount: subscriptions.length,
          truncated,
        },
      });
    }
    return { runId, completedAt };
  } catch (error) {
    const errorCode = safeErrorCode(error);
    const completedAt = new Date().toISOString();
    await Promise.all([
      params.admin
        .from("finance_provider_sync_runs")
        .update({
          status: "failed",
          error_code: errorCode,
          completed_at: completedAt,
        })
        .eq("id", runId)
        .eq("organization_id", params.organizationId),
      params.admin
        .from("merchant_accounts")
        .update({ sync_error_code: errorCode })
        .eq("organization_id", params.organizationId)
        .eq("provider", PROVIDER),
    ]);
    throw error;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  if (req.method !== "POST") {
    return json(req, 405, {
      code: "METHOD_NOT_ALLOWED",
      error: "Método não permitido.",
    });
  }

  const auth = await authenticateRequest(req);
  if (!auth) {
    return json(req, 401, { code: "UNAUTHORIZED", error: "Sessão inválida." });
  }

  let body: ConnectionRequest;
  try {
    body = (await req.json()) as ConnectionRequest;
  } catch {
    return json(req, 400, { code: "BAD_REQUEST", error: "JSON inválido." });
  }
  const action = textValue(body.action || "status") as ConnectionAction;
  const allowedActions = new Set<ConnectionAction>([
    "status",
    "connect",
    "rotate_key",
    "verify",
    "sync",
    "provision_webhook",
    "disconnect",
  ]);
  const organizationId = textValue(body.organizationId);
  if (!allowedActions.has(action) || !UUID_PATTERN.test(organizationId)) {
    return json(req, 400, {
      code: "BAD_REQUEST",
      error: "Solicitação inválida.",
    });
  }

  let admin: ReturnType<typeof adminClient>;
  try {
    admin = adminClient();
  } catch {
    return json(req, 503, {
      code: "CONNECTOR_NOT_CONFIGURED",
      error: "O conector financeiro ainda não foi configurado no servidor.",
    });
  }
  const access = await getAccess(admin, organizationId, auth.user.id);
  if (!access.canRead || (action !== "status" && !access.canManage)) {
    return json(req, 403, {
      code: "FORBIDDEN",
      error:
        action === "status"
          ? "Você não possui acesso financeiro nesta instituição."
          : "Somente a coordenação pode alterar a conexão financeira.",
    });
  }

  try {
    if (action === "status") {
      return json(
        req,
        200,
        await connectionStatus({
          admin,
          organizationId,
          canManage: access.canManage,
        }),
      );
    }

    if (action === "connect") {
      const apiKey = validateAsaasApiKey(textValue(body.apiKey));
      const existing = await readCredential(admin, organizationId);
      if (existing) throw new Error("asaas_already_connected");
      const environment = await detectAsaasEnvironment({ apiKey });
      const account = await validateAsaasConnection({ apiKey, environment });
      const masterSecret = textValue(
        Deno.env.get("PAYMENT_PROVIDER_ENCRYPTION_KEY"),
      );
      const encrypted = await encryptProviderSecret({
        plaintext: apiKey,
        masterSecret,
        context: providerSecretContext({
          organizationId,
          provider: PROVIDER,
          environment,
        }),
      });
      const keyHint = `••••${apiKey.slice(-4)}`;
      const { error } = await admin.rpc("connect_asaas_receivables_v1", {
        p_org_id: organizationId,
        p_environment: environment,
        p_external_account_id: account.walletId,
        p_account_status: account.accountStatus,
        p_key_hint: keyHint,
        p_secret_ciphertext: encrypted.ciphertext,
        p_secret_iv: encrypted.iv,
        p_secret_fingerprint: encrypted.fingerprint,
        p_connected_by: auth.user.id,
      });
      if (error) throw new Error(error.message || "provider_connect_failed");
      return json(req, 200, {
        ...(await connectionStatus({
          admin,
          organizationId,
          canManage: access.canManage,
        })),
        receipt: {
          action: "connected",
          readOnly: true,
          discovered: {
            customerCount: account.customerCount,
            paymentCount: account.paymentCount,
            subscriptionCount: account.subscriptionCount,
          },
        },
      });
    }

    const credential = await readCredential(admin, organizationId);
    if (!credential) {
      return json(req, 409, {
        code: "ASAAS_NOT_CONNECTED",
        error: "Conecte uma conta Asaas antes de continuar.",
      });
    }

    if (action === "rotate_key") {
      const replacementApiKey = validateAsaasApiKey(textValue(body.apiKey));
      const replacementEnvironment = await detectAsaasEnvironment({
        apiKey: replacementApiKey,
      });
      const account = await validateAsaasConnection({
        apiKey: replacementApiKey,
        environment: replacementEnvironment,
      });
      const { data: currentMerchant, error: merchantReadError } = await admin
        .from("merchant_accounts")
        .select("id,external_account_id")
        .eq("organization_id", organizationId)
        .eq("provider", PROVIDER)
        .maybeSingle();
      if (merchantReadError || !currentMerchant?.id) {
        throw new Error("asaas_not_connected");
      }
      if (textValue(currentMerchant.external_account_id) !== account.walletId) {
        throw new Error("asaas_account_mismatch");
      }
      const masterSecret = textValue(
        Deno.env.get("PAYMENT_PROVIDER_ENCRYPTION_KEY"),
      );
      const encrypted = await encryptProviderSecret({
        plaintext: replacementApiKey,
        masterSecret,
        context: providerSecretContext({
          organizationId,
          provider: PROVIDER,
          environment: replacementEnvironment,
        }),
      });
      const keyHint = `••••${replacementApiKey.slice(-4)}`;
      const { error } = await admin.rpc("rotate_asaas_receivables_key_v1", {
        p_org_id: organizationId,
        p_environment: replacementEnvironment,
        p_external_account_id: account.walletId,
        p_account_status: account.accountStatus,
        p_key_hint: keyHint,
        p_secret_ciphertext: encrypted.ciphertext,
        p_secret_iv: encrypted.iv,
        p_secret_fingerprint: encrypted.fingerprint,
        p_rotated_by: auth.user.id,
      });
      if (error) throw new Error(error.message || "provider_key_rotate_failed");
      return json(req, 200, {
        ...(await connectionStatus({
          admin,
          organizationId,
          canManage: access.canManage,
        })),
        receipt: {
          action: "key_rotated",
          readOnly: true,
          historyPreserved: true,
        },
      });
    }

    const { apiKey, environment } = await decryptApiKey(
      organizationId,
      credential,
    );

    if (action === "verify") {
      const account = await validateAsaasConnection({ apiKey, environment });
      await admin
        .from("merchant_accounts")
        .update({
          status:
            account.accountStatus === "APPROVED" ? "active" : "restricted",
          account_status: account.accountStatus,
          last_verified_at: new Date().toISOString(),
          sync_error_code: null,
        })
        .eq("organization_id", organizationId)
        .eq("provider", PROVIDER);
      return json(req, 200, {
        ...(await connectionStatus({
          admin,
          organizationId,
          canManage: access.canManage,
        })),
        receipt: { action: "verified", readOnly: true },
      });
    }

    if (action === "sync") {
      const receipt = await syncHistory({
        admin,
        organizationId,
        userId: auth.user.id,
        apiKey,
        environment,
      });
      return json(req, 200, {
        ...(await connectionStatus({
          admin,
          organizationId,
          canManage: access.canManage,
        })),
        receipt: { action: "synchronized", readOnly: true, ...receipt },
      });
    }

    const { data: merchant } = await admin
      .from("merchant_accounts")
      .select("id,webhook_id")
      .eq("organization_id", organizationId)
      .eq("provider", PROVIDER)
      .maybeSingle();

    if (action === "provision_webhook") {
      if (textValue(merchant?.webhook_id)) {
        return json(req, 200, {
          ...(await connectionStatus({
            admin,
            organizationId,
            canManage: access.canManage,
          })),
          receipt: { action: "webhook_already_configured" },
        });
      }
      const supabaseUrl = textValue(Deno.env.get("SUPABASE_URL")).replace(
        /\/+$/,
        "",
      );
      const webhookUrl =
        textValue(Deno.env.get("ASAAS_WEBHOOK_URL")) ||
        `${supabaseUrl}/functions/v1/asaas-webhook`;
      const alertEmail = (
        textValue(Deno.env.get("ASAAS_WEBHOOK_ALERT_EMAIL")) ||
        textValue(auth.user.email)
      ).toLowerCase();
      let parsedWebhookUrl: URL;
      try {
        parsedWebhookUrl = new URL(webhookUrl);
      } catch {
        throw new Error("asaas_webhook_server_not_configured");
      }
      if (
        parsedWebhookUrl.protocol !== "https:" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertEmail)
      ) {
        throw new Error("asaas_webhook_server_not_configured");
      }
      const authToken = createSecureWebhookToken();
      const webhookId = await createAsaasWebhook({
        apiKey,
        environment,
        url: parsedWebhookUrl.toString(),
        email: alertEmail,
        authToken,
      });
      const tokenHash = await sha256Hex(authToken);
      const [{ error: credentialError }, { error: merchantError }] =
        await Promise.all([
          admin
            .from("payment_provider_credentials")
            .update({ webhook_token_hash: tokenHash })
            .eq("organization_id", organizationId)
            .eq("provider", PROVIDER),
          admin
            .from("merchant_accounts")
            .update({ webhook_id: webhookId, webhook_status: "configured" })
            .eq("organization_id", organizationId)
            .eq("provider", PROVIDER),
        ]);
      if (credentialError || merchantError) {
        try {
          await deleteAsaasWebhook({
            apiKey,
            environment,
            webhookId,
          });
        } catch {
          // The endpoint remains safe because the unpersisted token is unknown.
        }
        throw new Error("asaas_webhook_persist_failed");
      }
      return json(req, 200, {
        ...(await connectionStatus({
          admin,
          organizationId,
          canManage: access.canManage,
        })),
        receipt: { action: "webhook_configured" },
      });
    }

    let providerWebhookRemoved = true;
    const webhookId = textValue(merchant?.webhook_id);
    if (webhookId) {
      try {
        await deleteAsaasWebhook({ apiKey, environment, webhookId });
      } catch {
        providerWebhookRemoved = false;
      }
    }
    const { error } = await admin.rpc("disconnect_asaas_receivables_v1", {
      p_org_id: organizationId,
      p_disconnected_by: auth.user.id,
    });
    if (error) throw new Error("provider_disconnect_failed");
    return json(req, 200, {
      ...(await connectionStatus({
        admin,
        organizationId,
        canManage: access.canManage,
      })),
      receipt: {
        action: "disconnected",
        providerWebhookRemoved,
        historyPreserved: true,
      },
    });
  } catch (error) {
    const mapped = userError(error);
    return json(req, mapped.status, mapped);
  }
});
