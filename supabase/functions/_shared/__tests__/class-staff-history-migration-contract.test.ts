import { readFileSync } from "node:fs";
import path from "node:path";

const migration = readFileSync(
  path.resolve(__dirname, "..", "..", "..", "migrations", "20260921114136_class_staff_history_and_transitions.sql"),
  "utf8"
);

describe("class staff history migration contract", () => {
  test("keeps temporal identities, substitutions and revisions append-preserving", () => {
    expect(migration).toContain("create table if not exists public.class_staff_tenures");
    expect(migration).toContain("create table if not exists public.class_staff_substitutions");
    expect(migration).toContain("create table if not exists public.class_staff_tenure_revisions");
    expect(migration).toContain("create table if not exists public.class_transition_summary_revisions");
    expect(migration).toContain("date_precision text not null default 'exact'");
  });

  test("separates read and manage access during an active absence", () => {
    expect(migration).toContain("create or replace function public.can_read_class");
    expect(migration).toContain("create or replace function public.can_manage_class");
    expect(migration).toContain("substitution.absent_user_id = staff.user_id");
    expect(migration).toContain("current_date between substitution.starts_on and substitution.ends_on");
  });

  test("uses versioned idempotent mutations instead of deleting history", () => {
    expect(migration).toContain("p_expected_version bigint");
    expect(migration).toContain("p_idempotency_key uuid");
    expect(migration).toContain("STALE_CLASS_STAFF_VERSION");
    expect(migration).toContain("class_staff_change_receipts");
    expect(migration).toContain("set ends_on = current_date");
  });

  test("materializes scheduled session coverage and preserves one-off exceptions", () => {
    expect(migration).toContain("add column if not exists substitution_id uuid");
    expect(migration).toContain("cross join generate_series(p_starts_on, p_ends_on");
    expect(migration).toContain("class.days @> jsonb_build_array");
    expect(migration).toContain("on conflict (organization_id, class_id, session_date) do nothing");
  });

  test("builds transition summaries only from replacement-authored evidence", () => {
    expect(migration).toContain("log.created_by = substitution.replacement_user_id");
    expect(migration).toContain("plan.created_by = substitution.replacement_user_id");
    expect(migration).toContain("Não há registros autorais suficientes");
    expect(migration).toContain("process_class_transition_jobs");
  });

  test("does not expose mutation tables directly to authenticated clients", () => {
    expect(migration).toContain("revoke all on public.class_staff_versions");
    expect(migration).toContain("from anon, public");
    expect(migration).not.toContain("grant insert on public.class_staff_tenures");
    expect(migration).not.toContain("grant update on public.class_staff_substitutions");
  });
});
