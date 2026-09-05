import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { createAsaasWebhookHandler } from "../_shared/asaas-webhook-handler.ts";
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


Deno.serve(createAsaasWebhookHandler({
  async findScope(tokenHash) {
    const { data, error } = await adminClient().from("payment_provider_credentials")
      .select("organization_id,connection_id").eq("provider", "asaas")
      .eq("webhook_token_hash", tokenHash).maybeSingle();
    if (error) throw error;
    return data?.organization_id && data?.connection_id
      ? { organizationId: data.organization_id, connectionId: data.connection_id } : null;
  },
  async matchCustomer(scope, customerId) {
    const { data, error } = await adminClient().from("provider_customers")
      .select("match_status").eq("organization_id", scope.organizationId)
      .eq("connection_id", scope.connectionId).eq("external_customer_id", customerId).maybeSingle();
    if (error) throw error;
    return data?.match_status === "matched" || data?.match_status === "ambiguous" ? data.match_status : "unmatched";
  },
  async findInvoice(scope, externalReference) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(externalReference)) return null;
    const { data, error } = await adminClient().from("invoices").select("id")
      .eq("organization_id", scope.organizationId).eq("id", externalReference).maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  },
  async processEvent(command) {
    const { data, error } = await adminClient().rpc("process_asaas_event_v2", command);
    if (error || typeof data?.duplicate !== "boolean") throw error ?? new Error("invalid_event_receipt");
    return { duplicate: data.duplicate };
  },
}));
