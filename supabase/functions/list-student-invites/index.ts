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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return createError(500, "SERVER_ERROR", "Missing Supabase service role config");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("student_invites")
    .select("id, student_id, created_at, expires_at, invited_via, invited_to, revoked, students(name)")
    .eq("created_by", user.id)
    .eq("revoked", false)
    .is("used_at", null)
    .gte("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return createError(500, "SERVER_ERROR", "Failed to list invites");
  }

  const invites = (data ?? []).map((row) => ({
    id: row.id,
    student_id: row.student_id,
    student_name: (row.students as { name?: string } | null)?.name ?? row.student_id,
    created_at: row.created_at,
    expires_at: row.expires_at,
    invited_via: row.invited_via,
    invited_to: row.invited_to,
  }));

  return new Response(JSON.stringify({ invites }), { headers: jsonHeaders });
});
