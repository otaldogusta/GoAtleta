import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import {
  mapAsaasPaymentRecord,
  mapAsaasSubscriptionRecord,
  type ProviderMatchStatus,
} from "../_shared/asaas-sync.ts";
import { sha256Hex } from "../_shared/provider-secret.ts";
import type {
  AsaasPayment,
  AsaasSubscription,
} from "../_shared/asaas-client.ts";

type AsaasWebhookPayload = {
  id?: unknown;
  event?: unknown;
  dateCreated?: unknown;
  account?: { id?: unknown } | null;
  payment?: AsaasPayment | null;
  subscription?: AsaasSubscription | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 512_000;
const PROVIDER = "asaas";

const textValue = (value: unknown) => String(value ?? "").trim();

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

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const eventDate = (value: unknown) => {
  const normalized = textValue(value).replace(" ", "T");
  const parsed = new Date(
    /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized)
      ? normalized
      : `${normalized}Z`,
  );
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
};

const customerMatchStatus = async (
  admin: ReturnType<typeof adminClient>,
  organizationId: string,
  externalCustomerId: string,
): Promise<ProviderMatchStatus> => {
  if (!externalCustomerId) return "unmatched";
  const { data } = await admin
    .from("provider_customers")
    .select("match_status")
    .eq("organization_id", organizationId)
    .eq("provider", PROVIDER)
    .eq("external_customer_id", externalCustomerId)
    .maybeSingle();
  const status = textValue(data?.match_status);
  return status === "matched" || status === "ambiguous" ? status : "unmatched";
};

const linkedInvoice = async (
  admin: ReturnType<typeof adminClient>,
  organizationId: string,
  externalReference: unknown,
) => {
  const candidate = textValue(externalReference);
  if (!UUID_PATTERN.test(candidate)) return null;
  const { data } = await admin
    .from("invoices")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", candidate)
    .maybeSingle();
  return textValue(data?.id) || null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { received: false, code: "METHOD_NOT_ALLOWED" });
  }
  const authToken = textValue(req.headers.get("asaas-access-token"));
  if (authToken.length < 32 || authToken.length > 255 || /\s/.test(authToken)) {
    return json(401, { received: false, code: "WEBHOOK_UNAUTHORIZED" });
  }

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return json(400, { received: false, code: "WEBHOOK_BODY_INVALID" });
  }
  if (!rawBody || new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json(413, { received: false, code: "WEBHOOK_BODY_INVALID" });
  }

  let payload: AsaasWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as AsaasWebhookPayload;
  } catch {
    return json(400, { received: false, code: "WEBHOOK_JSON_INVALID" });
  }
  const eventId = textValue(payload.id);
  const eventType = textValue(payload.event).toUpperCase();
  if (!eventId || eventId.length > 240 || !eventType || eventType.length > 120) {
    return json(400, { received: false, code: "WEBHOOK_EVENT_INVALID" });
  }

  let admin: ReturnType<typeof adminClient>;
  try {
    admin = adminClient();
  } catch {
    return json(503, { received: false, code: "WEBHOOK_NOT_CONFIGURED" });
  }

  const tokenHash = await sha256Hex(authToken);
  const { data: credential, error: credentialError } = await admin
    .from("payment_provider_credentials")
    .select("organization_id")
    .eq("provider", PROVIDER)
    .eq("webhook_token_hash", tokenHash)
    .maybeSingle();
  const organizationId = textValue(credential?.organization_id);
  if (credentialError || !organizationId) {
    return json(401, { received: false, code: "WEBHOOK_UNAUTHORIZED" });
  }

  const payloadHash = await sha256Hex(rawBody);
  const { data: insertedEvent, error: eventError } = await admin
    .from("provider_events")
    .insert({
      organization_id: organizationId,
      provider: PROVIDER,
      external_event_id: eventId,
      event_type: eventType,
      payload_hash: payloadHash,
      occurred_at: eventDate(payload.dateCreated),
      processing_status: "received",
    })
    .select("id")
    .single();
  if (eventError?.code === "23505") {
    return json(200, { received: true, duplicate: true });
  }
  if (eventError || !insertedEvent?.id) {
    return json(503, { received: false, code: "WEBHOOK_PERSIST_FAILED" });
  }

  const providerEventId = textValue(insertedEvent.id);
  let processingStatus: "processed" | "ignored" | "failed" = "ignored";
  let processingErrorCode: string | null = null;
  try {
    if (payload.payment?.id && payload.payment?.customer) {
      const invoiceId = await linkedInvoice(
        admin,
        organizationId,
        payload.payment.externalReference,
      );
      const matchStatus = invoiceId
        ? "matched"
        : await customerMatchStatus(
            admin,
            organizationId,
            textValue(payload.payment.customer),
          );
      const { error } = await admin.from("provider_receivables").upsert(
        mapAsaasPaymentRecord({
          organizationId,
          payment: payload.payment,
          matchStatus,
          invoiceId,
        }),
        { onConflict: "organization_id,provider,external_payment_id" },
      );
      if (error) throw new Error("provider_receivable_upsert_failed");
      processingStatus = "processed";
    } else if (payload.subscription?.id && payload.subscription?.customer) {
      const matchStatus = await customerMatchStatus(
        admin,
        organizationId,
        textValue(payload.subscription.customer),
      );
      const { error } = await admin.from("provider_subscriptions").upsert(
        mapAsaasSubscriptionRecord({
          organizationId,
          subscription: payload.subscription,
          matchStatus,
        }),
        { onConflict: "organization_id,provider,external_subscription_id" },
      );
      if (error) throw new Error("provider_subscription_upsert_failed");
      processingStatus = "processed";
    }
  } catch (error) {
    processingStatus = "failed";
    processingErrorCode = (
      error instanceof Error ? error.message : "webhook_processing_failed"
    )
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .slice(0, 120);
  }

  await admin
    .from("provider_events")
    .update({
      processing_status: processingStatus,
      processing_error_code: processingErrorCode,
      processed_at: new Date().toISOString(),
    })
    .eq("id", providerEventId)
    .eq("organization_id", organizationId);

  if (processingStatus === "failed") {
    return json(503, { received: false, code: "WEBHOOK_PROCESSING_FAILED" });
  }
  return json(200, { received: true });
});
