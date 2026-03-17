import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const toHex = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
};

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

  let payload: { token: string } = {};
  try {
    payload = (await req.json()) as { token: string };
  } catch {
    return createError(400, "INVALID_REQUEST", "Invalid JSON");
  }

  const token = (payload.token ?? "").trim();
  if (!token) {
    return createError(400, "INVALID_REQUEST", "Missing token");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return createError(500, "SERVER_ERROR", "Missing Supabase service role config");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const tokenHash = await sha256(token);

  const { data: invite, error: inviteError } = await supabase
    .from("student_invites")
    .select("id, student_id, expires_at, used_at, claimed_by, revoked")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (inviteError) {
    console.error("claim-student-invite: lookup failed", inviteError.message);
    return createError(500, "SERVER_ERROR", "Invite lookup failed");
  }

  if (!invite) {
    return createError(400, "INVITE_INVALID", "Invalid invite");
  }

  if (invite.revoked) {
    return createError(400, "INVITE_REVOKED", "Invite revoked");
  }

  if (invite.used_at) {
    if (invite.claimed_by === user.id) {
      return new Response(JSON.stringify({ status: "ok", student_id: invite.student_id }), {
        headers: jsonHeaders,
      });
    }
    return createError(400, "INVITE_ALREADY_USED", "Invite already used");
  }

  if (invite.expires_at) {
    const expiresAt = new Date(invite.expires_at);
    if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return createError(400, "INVITE_EXPIRED", "Invite expired");
    }
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("student_user_id, login_email")
    .eq("id", invite.student_id)
    .maybeSingle();

  if (studentError) {
    console.error("claim-student-invite: student lookup failed", studentError.message);
    return createError(500, "SERVER_ERROR", "Student lookup failed");
  }

  if (!student) {
    return createError(404, "STUDENT_NOT_FOUND", "Student not found");
  }

  if (student.student_user_id && student.student_user_id !== user.id) {
    return createError(409, "STUDENT_ALREADY_LINKED", "Student already linked");
  }

  const normalizedEmail = (user.email ?? "").trim().toLowerCase();
  const updates: Record<string, unknown> = {
    student_user_id: user.id,
  };
  if (!student.login_email && normalizedEmail) {
    updates.login_email = normalizedEmail;
  }

  const { error: studentUpdateError } = await supabase
    .from("students")
    .update(updates)
    .eq("id", invite.student_id);

  if (studentUpdateError) {
    console.error("claim-student-invite: student update failed", studentUpdateError.message);
    return createError(500, "SERVER_ERROR", "Failed to link student");
  }

  const nowIso = new Date().toISOString();
  const { error: inviteUpdateError } = await supabase
    .from("student_invites")
    .update({ used_at: nowIso, claimed_by: user.id })
    .eq("id", invite.id);

  if (inviteUpdateError) {
    console.error("claim-student-invite: invite update failed", inviteUpdateError.message);
  }

  return new Response(
    JSON.stringify({ status: "ok", student_id: invite.student_id }),
    { headers: jsonHeaders }
  );
});
