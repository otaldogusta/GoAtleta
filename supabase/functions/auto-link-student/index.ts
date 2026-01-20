import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const getHookSecret = () =>
  Deno.env.get("AUTH_HOOK_SECRET") ??
  Deno.env.get("SUPABASE_AUTH_HOOK_SECRET") ??
  "";

const isAuthorized = (req: Request) => {
  const secret = getHookSecret();
  if (!secret) return true;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const record = extractRecord(payload);
  const recordObj = record as Record<string, unknown> | null;
  const userId =
    (recordObj?.id && String(recordObj.id)) ||
    (payload && typeof payload === "object" && "user_id" in payload
      ? String((payload as Record<string, unknown>).user_id)
      : "");
  const email =
    (recordObj?.email && String(recordObj.email)) ||
    (payload && typeof payload === "object" && "email" in payload
      ? String((payload as Record<string, unknown>).email)
      : "");
  const normalizedEmail = email.trim().toLowerCase();

  if (!userId || !normalizedEmail) {
    return new Response(
      JSON.stringify({ status: "skipped", reason: "missing_user_or_email" }),
      { headers: jsonHeaders }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase service role config" }),
      { status: 500, headers: jsonHeaders }
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
      headers: jsonHeaders,
    });
  }

  return new Response(
    JSON.stringify({ status: "ok", linked: data?.length ?? 0 }),
    { headers: jsonHeaders }
  );
});
