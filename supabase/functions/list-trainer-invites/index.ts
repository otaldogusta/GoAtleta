import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateStringField } from "../_shared/input-validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const createError = (status: number, code: string, error: string) =>
  new Response(JSON.stringify({ code, error }), { status, headers: jsonHeaders });

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return createError(405, "INVALID_REQUEST", "Method not allowed");
  }

  const token = getBearerToken(req);
  if (!token) {
    return createError(401, "UNAUTHORIZED", "Unauthorized");
  }

  let payload: { organizationId: string } = { organizationId: "" };
  try {
    payload = (await req.json()) as { organizationId: string };
  } catch {
    return createError(400, "INVALID_REQUEST", "Invalid JSON");
  }

  const orgValidation = validateStringField(payload.organizationId, {
    minLength: 36,
    maxLength: 36,
  });
  if (!orgValidation.ok) {
    return createError(400, "INVALID_REQUEST", `Invalid organizationId: ${orgValidation.error}`);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return createError(500, "SERVER_ERROR", "Missing Supabase service role config");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const userId = authData?.user?.id ?? "";
  if (authError || !userId) {
    return createError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { data: adminRow, error: adminError } = await supabase
    .from("organization_members")
    .select("role_level")
    .eq("organization_id", orgValidation.data)
    .eq("user_id", userId)
    .maybeSingle();

  if (adminError) {
    return createError(500, "SERVER_ERROR", "Organization lookup failed");
  }

  if (!adminRow) {
    return createError(404, "ORG_NOT_FOUND", "Organization not found");
  }

  if ((adminRow.role_level ?? 0) < 50) {
    return createError(403, "ORG_FORBIDDEN", "Forbidden");
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("trainer_invites")
    .select(
      "id, organization_id, target_role_level, created_at, expires_at, max_uses, uses, revoked, invited_via, invited_to"
    )
    .eq("organization_id", orgValidation.data)
    .eq("revoked", false)
    .gte("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return createError(500, "SERVER_ERROR", "Failed to list invites");
  }

  const invites = (data ?? []).filter((row) => (row.uses ?? 0) < (row.max_uses ?? 1));
  return new Response(JSON.stringify({ invites }), { headers: jsonHeaders });
});
