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

  let payload: { studentId: string; clearLoginEmail: boolean } = {};
  try {
    payload = (await req.json()) as {
      studentId: string;
      clearLoginEmail: boolean;
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
    .select("id, owner_id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) {
    console.error("revoke-student-access: student lookup failed", studentError.message);
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
    return new Response(JSON.stringify({ error: "Failed to revoke student access" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const { error: inviteUpdateError } = await supabase
    .from("student_invites")
    .update({ revoked: true })
    .eq("student_id", studentId);

  if (inviteUpdateError) {
    console.error("revoke-student-access: invite update failed", inviteUpdateError.message);
    return new Response(JSON.stringify({ error: "Failed to revoke student invites" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  return new Response(JSON.stringify({ status: "ok" }), { headers: jsonHeaders });
});
