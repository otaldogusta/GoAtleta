import { createEdgeFunction, createSuccess, createError } from "../_shared/framework.ts";

Deno.serve(createEdgeFunction({
  name: "list-student-invites",
  requireAuth: true,
  parseJson: false,
  handler: async ({ supabase, user }) => {
    const userId = user!.id;
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
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
