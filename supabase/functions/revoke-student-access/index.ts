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

  let payload: { studentId: string; clearLoginEmail: boolean } = {};
  try {
    payload = (await req.json()) as {
      studentId: string;
      clearLoginEmail: boolean;
    };
  } catch {
    return createError(400, "INVALID_REQUEST", "Invalid JSON");
  }

  const studentId = (payload.studentId ?? "").trim();
  if (!studentId) {
    return createError(400, "INVALID_REQUEST", "Missing studentId");
  }

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
    .select("id, owner_id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) {
    console.error("revoke-student-access: student lookup failed", studentError.message);
    return createError(500, "SERVER_ERROR", "Student lookup failed");
  }

  if (!student) {
    return createError(404, "STUDENT_NOT_FOUND", "Student not found");
  }

  if (student.owner_id && student.owner_id !== user.id) {
    return createError(403, "FORBIDDEN", "Forbidden");
  }

  const updates: Record<string, unknown> = {
    student_user_id: null,
  };
  if (payload.clearLoginEmail) {
    updates.login_email = null;
  }

  const { error: studentUpdateError } = await supabase
    .from("students")
    .update(updates)
    .eq("id", studentId);

  if (studentUpdateError) {
    console.error("revoke-student-access: student update failed", studentUpdateError.message);
    return createError(500, "SERVER_ERROR", "Failed to revoke student access");
  }

  const { error: inviteUpdateError } = await supabase
    .from("student_invites")
    .update({ revoked: true })
    .eq("student_id", studentId);

  if (inviteUpdateError) {
    console.error("revoke-student-access: invite update failed", inviteUpdateError.message);
    return createError(500, "SERVER_ERROR", "Failed to revoke student invites");
  }

  return new Response(JSON.stringify({ status: "ok" }), { headers: jsonHeaders });
});
