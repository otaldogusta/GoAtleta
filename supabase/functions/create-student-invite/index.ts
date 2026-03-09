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

const INVITE_TTL_DAYS = 30;
const ALLOWED_CHANNELS = new Set(["whatsapp", "email", "link"]);

const toHex = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
};

const normalizeChannel = (value: string) => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "whatsapp";
  if (!ALLOWED_CHANNELS.has(normalized)) return "whatsapp";
  return normalized;
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

  let payload: { studentId: string; invitedVia: string; invitedTo: string } = {};
  try {
    payload = (await req.json()) as {
      studentId: string;
      invitedVia: string;
      invitedTo: string;
    };
  } catch {
    return createError(400, "INVALID_REQUEST", "Invalid JSON");
  }

  const studentIdValidation = validateStringField(payload.studentId, {
    minLength: 1,
    maxLength: 128,
  });
  if (!studentIdValidation.ok) {
    return createError(400, "INVALID_REQUEST", `Invalid studentId: ${studentIdValidation.error}`);
  }
  const studentId = studentIdValidation.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return createError(500, "SERVER_ERROR", "Missing Supabase service role config");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name, phone, login_email, owner_id, student_user_id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) {
    console.error("create-student-invite: student lookup failed", studentError.message);
    return createError(500, "SERVER_ERROR", "Student lookup failed");
  }

  if (!student) {
    return createError(404, "STUDENT_NOT_FOUND", "Student not found");
  }

  if (student.owner_id && student.owner_id !== user.id) {
    return createError(403, "FORBIDDEN", "Forbidden");
  }

  if (student.student_user_id && student.student_user_id !== user.id) {
    return createError(409, "STUDENT_ALREADY_LINKED", "Student already linked");
  }

  const token = crypto.randomUUID();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const invitedVia = normalizeChannel(String(payload.invitedVia ?? ""));
  const invitedToValidation = validateStringField(payload.invitedTo, { maxLength: 255 });
  const invitedTo = invitedToValidation.ok && invitedToValidation.data
    ? invitedToValidation.data
    : null;

  const { error: insertError } = await supabase.from("student_invites").insert({
    student_id: studentId,
    token_hash: tokenHash,
    created_by: user.id,
    expires_at: expiresAt.toISOString(),
    invited_via: invitedVia,
    invited_to: invitedTo,
  });

  if (insertError) {
    console.error("create-student-invite: insert failed", insertError.message);
    return createError(500, "SERVER_ERROR", "Failed to create invite");
  }

  return new Response(
    JSON.stringify({
      token,
      expires_at: expiresAt.toISOString(),
      student_id: studentId,
    }),
    { headers: jsonHeaders }
  );
});
