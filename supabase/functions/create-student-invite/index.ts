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

const normalizeChannel = (value?: string) => {
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
  if (error || !data?.user) return null;
  return data.user;
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

  const user = await requireUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  let payload: { studentId?: string; invitedVia?: string; invitedTo?: string } = {};
  try {
    payload = (await req.json()) as {
      studentId?: string;
      invitedVia?: string;
      invitedTo?: string;
    };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const studentId = (payload.studentId ?? "").trim();
  if (!studentId) {
    return new Response(JSON.stringify({ error: "Missing studentId" }), {
      status: 400,
      headers: jsonHeaders,
    });
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

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name, phone, login_email, owner_id, student_user_id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) {
    console.error("create-student-invite: student lookup failed", studentError.message);
    return new Response(JSON.stringify({ error: "Student lookup failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  if (!student) {
    return new Response(JSON.stringify({ error: "Student not found" }), {
      status: 404,
      headers: jsonHeaders,
    });
  }

  if (student.owner_id && student.owner_id !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: jsonHeaders,
    });
  }

  if (student.student_user_id && student.student_user_id !== user.id) {
    return new Response(JSON.stringify({ error: "Student already linked" }), {
      status: 409,
      headers: jsonHeaders,
    });
  }

  const token = crypto.randomUUID();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const invitedVia = normalizeChannel(payload.invitedVia);
  const invitedTo = payload.invitedTo?.trim() || null;

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
    return new Response(JSON.stringify({ error: "Failed to create invite" }), {
      status: 500,
      headers: jsonHeaders,
    });
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
