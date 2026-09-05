import type { AsaasPayment, AsaasSubscription } from "./asaas-client.ts";
import { mapAsaasPaymentRecord, mapAsaasSubscriptionRecord, type ProviderMatchStatus } from "./asaas-sync.ts";
import { sha256Hex } from "./provider-secret.ts";

export type WebhookScope = { organizationId: string; connectionId: string };
export type AsaasEventCommand = {
  p_org_id: string;
  p_connection_id: string;
  p_event_id: string;
  p_event_type: string;
  p_payload_hash: string;
  p_occurred_at: string | null;
  p_payment: ReturnType<typeof mapAsaasPaymentRecord> | null;
  p_subscription: ReturnType<typeof mapAsaasSubscriptionRecord> | null;
};

export type AsaasWebhookDependencies = {
  findScope: (tokenHash: string) => Promise<WebhookScope | null>;
  matchCustomer: (scope: WebhookScope, customerId: string) => Promise<ProviderMatchStatus>;
  findInvoice: (scope: WebhookScope, externalReference: string) => Promise<string | null>;
  processEvent: (command: AsaasEventCommand) => Promise<{ duplicate: boolean }>;
};

const text = (value: unknown) => String(value ?? "").trim();
const json = (status: number, payload: unknown) => new Response(JSON.stringify(payload), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const eventDate = (value: unknown) => {
  const normalized = text(value).replace(" ", "T");
  const parsed = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
};

export const createAsaasWebhookHandler = (deps: AsaasWebhookDependencies) => async (req: Request) => {
  if (req.method !== "POST") return json(405, { received: false, code: "METHOD_NOT_ALLOWED" });
  const authToken = text(req.headers.get("asaas-access-token"));
  if (authToken.length < 32 || authToken.length > 255 || /\s/.test(authToken)) {
    return json(401, { received: false, code: "WEBHOOK_UNAUTHORIZED" });
  }
  let rawBody: string;
  let payload: Record<string, unknown>;
  try {
    rawBody = await req.text();
    if (!rawBody || new TextEncoder().encode(rawBody).byteLength > 512_000) {
      return json(413, { received: false, code: "WEBHOOK_BODY_INVALID" });
    }
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    payload = parsed as Record<string, unknown>;
  } catch {
    return json(400, { received: false, code: "WEBHOOK_JSON_INVALID" });
  }
  const eventId = text(payload.id);
  const eventType = text(payload.event).toUpperCase();
  if (!eventId || eventId.length > 240 || !eventType || eventType.length > 120) {
    return json(400, { received: false, code: "WEBHOOK_EVENT_INVALID" });
  }
  try {
    const scope = await deps.findScope(await sha256Hex(authToken));
    if (!scope) return json(401, { received: false, code: "WEBHOOK_UNAUTHORIZED" });
    const command: AsaasEventCommand = {
      p_org_id: scope.organizationId, p_connection_id: scope.connectionId,
      p_event_id: eventId, p_event_type: eventType, p_payload_hash: await sha256Hex(rawBody),
      p_occurred_at: eventDate(payload.dateCreated), p_payment: null, p_subscription: null,
    };
    const payment = payload.payment as AsaasPayment | undefined;
    const subscription = payload.subscription as AsaasSubscription | undefined;
    if (payment?.id && payment?.customer) {
      const invoiceId = await deps.findInvoice(scope, text(payment.externalReference));
      const matchStatus = invoiceId ? "matched" : await deps.matchCustomer(scope, text(payment.customer));
      command.p_payment = mapAsaasPaymentRecord({ ...scope, payment, invoiceId, matchStatus });
    } else if (subscription?.id && subscription?.customer) {
      const matchStatus = await deps.matchCustomer(scope, text(subscription.customer));
      command.p_subscription = mapAsaasSubscriptionRecord({ ...scope, subscription, matchStatus });
    }
    // The RPC commits projection + event together and serializes concurrent IDs.
    // A failed RPC is never acknowledged, so provider redelivery can recover it.
    const receipt = await deps.processEvent(command);
    return json(200, { received: true, ...(receipt.duplicate ? { duplicate: true } : {}) });
  } catch {
    return json(503, { received: false, code: "WEBHOOK_PROCESSING_FAILED" });
  }
};
