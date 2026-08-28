import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const studentsSource = readFileSync(resolve(__dirname, "../students.ts"), "utf8");
const migrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260815010512_add_student_inactivation_audit.sql"
  ),
  "utf8"
);
const lifecycleMigrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260825211640_student_lifecycle_financial_history.sql"
  ),
  "utf8"
);

describe("student inactivation audit contract", () => {
  test("keeps the schema change additive and bounded", () => {
    expect(migrationSource).toContain("add column if not exists inactivated_by");
    expect(migrationSource).toContain("add column if not exists inactivation_reason");
    expect(migrationSource).toContain("char_length(inactivation_reason) <= 240");
    expect(migrationSource).not.toMatch(/\bdrop\s+table\b/i);
    expect(migrationSource).not.toMatch(/\bdelete\s+from\b/i);
  });

  test("records the actor and reason and clears the audit when reactivated", () => {
    expect(studentsSource).toContain("payload.inactivated_by = (await getSessionUserId()) || null");
    expect(studentsSource).toContain("payload.inactivation_reason = inactivationReason");
    expect(studentsSource).toContain("Informe o motivo da inativação");
    expect(studentsSource).toContain("payload.inactivated_by = null");
    expect(studentsSource).toContain("payload.inactivation_reason = null");
  });

  test("keeps append-only lifecycle and financial event logs protected", () => {
    expect(lifecycleMigrationSource).toContain("create table public.student_membership_events");
    expect(lifecycleMigrationSource).toContain("create table public.student_financial_events");
    expect(lifecycleMigrationSource).toContain("alter table public.student_membership_events enable row level security");
    expect(lifecycleMigrationSource).toContain("Financial permission is required");
    expect(lifecycleMigrationSource).toContain("Inactivation reason is required");
    expect(lifecycleMigrationSource).toContain("students_class_workspace_fkey");
    expect(lifecycleMigrationSource).toContain("student_membership_events_student_idx");
    expect(lifecycleMigrationSource).toContain("student_financial_events_changed_by_idx");
    expect(lifecycleMigrationSource).not.toMatch(/update\s+public\.students\s+set\s+financial_status/i);
  });

  test("reserves physical student deletion for the LGPD service workflow", () => {
    expect(lifecycleMigrationSource).toContain(
      'drop policy if exists "students delete trainer" on public.students'
    );
    expect(lifecycleMigrationSource).toContain(
      "revoke delete on table public.students from authenticated"
    );
    expect(lifecycleMigrationSource).toContain(
      "grant delete on table public.students to service_role"
    );
    expect(lifecycleMigrationSource).not.toMatch(
      /grant\s+[^;]*\bdelete\b[^;]*on table public\.students[^;]*to authenticated/i
    );
  });

  test("keeps inactivation audit fields server-owned and records reason corrections", () => {
    expect(lifecycleMigrationSource).toContain(
      "new.inactivated_at := old.inactivated_at"
    );
    expect(lifecycleMigrationSource).toContain(
      "new.inactivated_by := old.inactivated_by"
    );
    expect(lifecycleMigrationSource).toMatch(
      /before insert or update of[\s\S]*inactivated_at,[\s\S]*inactivated_by[\s\S]*on public\.students/
    );
    expect(lifecycleMigrationSource).toContain("'reason_change'");
    expect(lifecycleMigrationSource).toMatch(
      /after insert or update of membership_status, financial_status, inactivation_reason/
    );
  });

  test("serializes v2 access retries and locks the target membership row", () => {
    const accessChangeV2 = lifecycleMigrationSource.slice(
      lifecycleMigrationSource.indexOf(
        "create or replace function public.admin_apply_member_access_change_v2"
      ),
      lifecycleMigrationSource.indexOf(
        "revoke all on function public.admin_apply_member_access_change_v2"
      )
    );

    expect(accessChangeV2).toContain("pg_advisory_xact_lock");
    expect(accessChangeV2).toContain(
      "'admin_apply_member_access_change_v2:' || p_idempotency_key::text"
    );
    expect(accessChangeV2).toContain("for update of member");
    expect(accessChangeV2.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      accessChangeV2.indexOf("from private.member_access_change_receipts")
    );
    expect(accessChangeV2.indexOf("for update of member")).toBeLessThan(
      accessChangeV2.indexOf(
        "from public.admin_apply_member_access_change("
      )
    );
    expect(accessChangeV2).toContain(
      "v_existing.role_after is distinct from p_new_role_level"
    );
    expect(accessChangeV2).toContain(
      "v_existing.class_ids_after is distinct from v_requested_class_ids"
    );
    expect(accessChangeV2).toContain(
      "v_existing.permission_keys_after is distinct from v_requested_permission_keys"
    );
    expect(accessChangeV2).toContain(
      "raise exception 'Idempotency key already used for another operation'"
    );
  });
});
