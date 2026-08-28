import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const makeJsonHeaders = (req: Request) => ({ ...buildCorsHeaders(req), "Content-Type": "application/json" });

const getHookSecret = () => {
  const secret =
    Deno.env.get("AUTH_HOOK_SECRET") ??
    Deno.env.get("SUPABASE_AUTH_HOOK_SECRET") ??
    "";

  if (!secret) {
    throw new Error(
      "auto-link-student: AUTH_HOOK_SECRET or SUPABASE_AUTH_HOOK_SECRET must be configured to enable webhook authentication"
    );
  }

  return secret;
};

const isAuthorized = (req: Request) => {
  const secret = getHookSecret();
  if (!secret) return false;
  const header =
    req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!header) return false;
  if (header === secret) return true;
  if (header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim() === secret;
  }
  return false;
};

const extractRecord = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, unknown>;
  if (body.record && typeof body.record === "object") return body.record;
  if (body.user && typeof body.user === "object") return body.user;
  if (body.data && typeof body.data === "object") {
    const data = body.data as Record<string, unknown>;
    if (data.record && typeof data.record === "object") return data.record;
    if (data.user && typeof data.user === "object") return data.user;
  }
  return null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const hasTrustedEmailProof = (record: Record<string, unknown>) => {
  if (record.is_anonymous === true) return false;
  const appMetadata = asRecord(
    record.raw_app_meta_data ?? record.app_metadata
  );
  const providers = [
    ...(Array.isArray(appMetadata.providers) ? appMetadata.providers : []),
    appMetadata.provider,
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
  const hasTrustedExternalProvider = providers.some((provider) =>
    ["google", "apple", "facebook"].includes(provider)
  );
  return hasTrustedExternalProvider
    || (
      typeof appMetadata.email_verified_hybrid_at === "string"
      && Boolean(appMetadata.email_verified_hybrid_at.trim())
    );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflight(req);
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: makeJsonHeaders(req),
    });
  }

  try {
    if (!isAuthorized(req)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: makeJsonHeaders(req),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Configuration error";
    console.error("auto-link-student auth check failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: makeJsonHeaders(req),
    });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: makeJsonHeaders(req),
    });
  }

  const record = extractRecord(payload);
  const recordObj = record as Record<string, unknown> | null;
  const userId =
    (recordObj?.id ? String(recordObj.id) : "") ||
    (payload && typeof payload === "object" && "user_id" in payload
       ? String((payload as Record<string, unknown>).user_id)
       : "");
  const email =
    (recordObj?.email ? String(recordObj.email) : "") ||
    (payload && typeof payload === "object" && "email" in payload
       ? String((payload as Record<string, unknown>).email)
       : "");
  const normalizedEmail = email.trim().toLowerCase();

  if (!userId || !normalizedEmail) {
    return new Response(
      JSON.stringify({ status: "skipped", reason: "missing_user_or_email" }),
      { headers: makeJsonHeaders(req) }
    );
  }

  if (!recordObj || !hasTrustedEmailProof(recordObj)) {
    return new Response(
      JSON.stringify({ status: "skipped", reason: "email_not_verified" }),
      { headers: makeJsonHeaders(req) }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase service role config" }),
      { status: 500, headers: makeJsonHeaders(req) }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("students")
    .update({ student_user_id: userId })
    .is("student_user_id", null)
    .eq("login_email", normalizedEmail)
    .select("id");

  if (error) {
    console.error("auto-link-student: update failed", error.message);
    return new Response(JSON.stringify({ error: "Update failed" }), {
      status: 500,
      headers: makeJsonHeaders(req),
    });
  }
  
  return new Response(
    JSON.stringify({ status: "ok", linked: data ? data.length : 0 }),
    { headers: makeJsonHeaders(req) }
  );
});
