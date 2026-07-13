import { createEdgeFunction, createSuccess, createError } from "../_shared/framework.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(createEdgeFunction({
  name: "list-student-invites",
  requireAuth: true,
  parseJson: false,
  handler: async ({ user }) => {
    const userId = user!.id;
    const nowIso = new Date().toISOString();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return createError(500, "SERVER_ERROR", "Missing Supabase configuration");
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Authentication is enforced by the framework. The creator filter keeps
    // this server-side query scoped to the current user.
    const { data, error } = await admin
      .from("student_invites")
      .select("id, student_id, created_at, expires_at, invited_via, invited_to, revoked, students(name)")
      .eq("created_by", userId)
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

    return createSuccess({ invites });
  }
}));
