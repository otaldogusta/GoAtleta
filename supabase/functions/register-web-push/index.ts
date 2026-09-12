import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { validateStringField } from "../_shared/input-validation.ts";

const MAX_WEB_SUBSCRIPTIONS_PER_USER = 8;

type WebPushRegistrationPayload = {
  action?: "subscribe" | "unsubscribe";
  organizationId?: string;
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  userAgent?: string;
};

const jsonHeaders = (request: Request) => ({
  ...buildCorsHeaders(request),
  "Content-Type": "application/json",
});

const createAnonClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  return url && anonKey
    ? createClient(url, anonKey, { auth: { persistSession: false } })
    : null;
};

const createServiceClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return url && serviceRoleKey
    ? createClient(url, serviceRoleKey, { auth: { persistSession: false } })
    : null;
};

const requireUser = async (request: Request) => {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const client = createAnonClient();
  if (!token || !client) return null;
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
};

const isLinkedToOrganization = async (
  service: ReturnType<typeof createClient>,
  organizationId: string,
  userId: string,
) => {
  const [membership, students] = await Promise.all([
    service
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .limit(1),
    service
      .from("students")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("student_user_id", userId)
      .limit(1),
  ]);
  if (membership.error || students.error) throw new Error("Organization lookup failed.");
  return Boolean(membership.data?.length || students.data?.length);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return corsPreflight(request);
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders(request),
    });
  }

  const user = await requireUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders(request),
    });
  }

  const payload = await request.json().catch(() => null) as WebPushRegistrationPayload | null;
  const organization = validateStringField(payload?.organizationId, { minLength: 1, maxLength: 128 });
  const endpoint = validateStringField(payload?.endpoint, { minLength: 20, maxLength: 2048 });
  if (!payload || !organization.ok || !endpoint.ok) {
    return new Response(JSON.stringify({ error: "Invalid web push subscription." }), {
      status: 400,
      headers: jsonHeaders(request),
    });
  }
  try {
    if (new URL(endpoint.data).protocol !== "https:") throw new Error("Invalid protocol");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid web push endpoint." }), {
      status: 400,
      headers: jsonHeaders(request),
    });
  }

  const service = createServiceClient();
  if (!service) {
    return new Response(JSON.stringify({ error: "Missing service role configuration." }), {
      status: 500,
      headers: jsonHeaders(request),
    });
  }

  let linked = false;
  try {
    linked = await isLinkedToOrganization(service, organization.data, user.id);
  } catch {
    return new Response(JSON.stringify({ error: "Unable to validate organization access." }), {
      status: 500,
      headers: jsonHeaders(request),
    });
  }
  if (!linked) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: jsonHeaders(request),
    });
  }

  if (payload.action === "unsubscribe") {
    const { error } = await service
      .from("web_push_subscriptions")
      .delete()
      .eq("endpoint", endpoint.data)
      .eq("user_id", user.id);
    return new Response(JSON.stringify(error ? { error: error.message } : { status: "ok" }), {
      status: error ? 500 : 200,
      headers: jsonHeaders(request),
    });
  }

  const p256dh = validateStringField(payload.p256dh, { minLength: 40, maxLength: 256 });
  const auth = validateStringField(payload.auth, { minLength: 8, maxLength: 128 });
  const userAgent = validateStringField(payload.userAgent ?? "", { maxLength: 512 });
  if (!p256dh.ok || !auth.ok || !userAgent.ok) {
    return new Response(JSON.stringify({ error: "Invalid web push keys." }), {
      status: 400,
      headers: jsonHeaders(request),
    });
  }

  const [{ data: existing }, { count, error: countError }] = await Promise.all([
    service
      .from("web_push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint.data)
      .maybeSingle(),
    service
      .from("web_push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.data)
      .eq("user_id", user.id),
  ]);
  if (countError) {
    return new Response(JSON.stringify({ error: "Unable to count subscriptions." }), {
      status: 500,
      headers: jsonHeaders(request),
    });
  }
  if (!existing && Number(count ?? 0) >= MAX_WEB_SUBSCRIPTIONS_PER_USER) {
    return new Response(JSON.stringify({ error: "Web push subscription limit reached." }), {
      status: 409,
      headers: jsonHeaders(request),
    });
  }

  const { error } = await service.from("web_push_subscriptions").upsert({
    organization_id: organization.data,
    user_id: user.id,
    endpoint: endpoint.data,
    p256dh: p256dh.data,
    auth_key: auth.data,
    user_agent: userAgent.data || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });

  return new Response(JSON.stringify(error ? { error: error.message } : { status: "ok" }), {
    status: error ? 500 : 200,
    headers: jsonHeaders(request),
  });
});
