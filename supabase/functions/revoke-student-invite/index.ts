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

  let payload: { inviteId: string } = { inviteId: "" };
  try {
    payload = (await req.json()) as { inviteId: string };
  } catch {
    return createError(400, "INVALID_REQUEST", "Invalid JSON");
  }

  const inviteValidation = validateStringField(payload.inviteId, {
    minLength: 36,
    maxLength: 36,
  });
  if (!inviteValidation.ok) {
    return createError(400, "INVALID_REQUEST", `Invalid inviteId: ${inviteValidation.error}`);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return createError(500, "SERVER_ERROR", "Missing Supabase service role config");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: invite, error: inviteError } = await supabase
    .from("student_invites")
    .select("id, created_by")
    .eq("id", inviteValidation.data)
    .maybeSingle();

  if (inviteError) {
    return createError(500, "SERVER_ERROR", "Invite lookup failed");
  }

  if (!invite) {
    return createError(404, "INVITE_INVALID", "Invite not found");
  }

  if (invite.created_by !== user.id) {
    return createError(403, "FORBIDDEN", "Forbidden");
  }

  const { error: updateError } = await supabase
    .from("student_invites")
    .update({ revoked: true })
    .eq("id", inviteValidation.data);

  if (updateError) {
    return createError(500, "SERVER_ERROR", "Failed to revoke invite");
  }

  return new Response(JSON.stringify({ status: "ok" }), { headers: jsonHeaders });
});
