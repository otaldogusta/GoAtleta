import { createEdgeFunction, createSuccess, createError } from "../_shared/framework.ts";
import { validateStringField } from "../_shared/input-validation.ts";

type StudentInviteRow = {
  id?: unknown;
  student_id?: unknown;
  student_name?: unknown;
  created_at?: unknown;
  expires_at?: unknown;
  invited_via?: unknown;
  invited_to?: unknown;
};

Deno.serve(createEdgeFunction<{ organizationId?: string }>({
  name: "list-student-invites",
  requireAuth: true,
  parseJson: true,
  handler: async ({ supabase, body }) => {
    const organizationId = String(body?.organizationId ?? "").trim();
    const validation = validateStringField(organizationId, {
      minLength: 36,
      maxLength: 36,
    });
    if (!validation.ok) {
      return createError(400, "INVALID_REQUEST", "Invalid organizationId");
    }

    const { data, error } = await supabase.rpc(
      "list_student_invites_access",
      { p_org_id: validation.data }
    );

    if (error) {
      return createError(500, "SERVER_ERROR", "Failed to list invites");
    }

    const invites = ((data ?? []) as StudentInviteRow[]).map((row) => ({
      id: row.id,
      student_id: row.student_id,
      student_name: String(row.student_name ?? row.student_id),
      created_at: row.created_at,
      expires_at: row.expires_at,
      invited_via: row.invited_via,
      invited_to: row.invited_to,
    }));

    return createSuccess({ invites });
  }
}));
