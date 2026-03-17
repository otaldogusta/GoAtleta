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

const requireUser = (req: Request): { id: string; email?: string } | null => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    ) as Record<string, unknown>;
    const sub = payload["sub"];
    const exp = payload["exp"];
    if (typeof sub !== "string" || !sub) return null;
    if (typeof exp === "number" && exp < Date.now() / 1000) return null;
    return { id: sub, email: typeof payload["email"] === "string" ? payload["email"] : undefined };
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return createError(405, "INVALID_REQUEST", "Method not allowed");
  }

  const user = requireUser(req);
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
