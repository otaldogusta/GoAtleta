import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateStringField } from "../_shared/input-validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const createError = (status: number, code: string, error: string) =>
  new Response(JSON.stringify({ code, error }), { status, headers: jsonHeaders });

const createAnonClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
};

const requireUser = async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  const supabase = createAnonClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return createError(405, "INVALID_REQUEST", "Method not allowed");
  }

  const user = await requireUser(req);
  if (!user) {
    return createError(401, "UNAUTHORIZED", "Unauthorized");
  }

  let payload: { inviteId: string; organizationId: string } = {
    inviteId: "",
    organizationId: "",
  };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return createError(400, "INVALID_REQUEST", "Invalid JSON");
  }

  const inviteIdValidation = validateStringField(payload.inviteId, {
    minLength: 36,
    maxLength: 36,
  });
  const orgValidation = validateStringField(payload.organizationId, {
    minLength: 36,
    maxLength: 36,
  });
  if (!inviteIdValidation.ok || !orgValidation.ok) {
    return createError(400, "INVALID_REQUEST", "Invalid inviteId or organizationId");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return createError(500, "SERVER_ERROR", "Missing Supabase service role config");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: adminRow, error: adminError } = await supabase
    .from("organization_members")
    .select("role_level")
    .eq("organization_id", orgValidation.data)
    .eq("user_id", user.id)
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

  const { data: invite, error: inviteError } = await supabase
    .from("trainer_invites")
    .select("id, revoked")
    .eq("id", inviteIdValidation.data)
    .eq("organization_id", orgValidation.data)
    .maybeSingle();

  if (inviteError) {
    return createError(500, "SERVER_ERROR", "Invite lookup failed");
  }

  if (!invite) {
    return createError(404, "INVITE_INVALID", "Invite not found");
  }

  if (invite.revoked) {
    return new Response(JSON.stringify({ status: "ok" }), { headers: jsonHeaders });
  }

  const { error: updateError } = await supabase
    .from("trainer_invites")
    .update({ revoked: true })
    .eq("id", inviteIdValidation.data);

  if (updateError) {
    return createError(500, "SERVER_ERROR", "Failed to revoke invite");
  }

  return new Response(JSON.stringify({ status: "ok" }), { headers: jsonHeaders });
});
