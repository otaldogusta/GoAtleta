import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/migrations/20260825222458_protect_student_financial_status.sql"
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
const studentsSource = readFileSync(resolve(__dirname, "../students.ts"), "utf8");
const roleSource = readFileSync(resolve(__dirname, "../../auth/role.tsx"), "utf8");

describe("student financial privacy contract", () => {
  test("casts legacy text timestamps before lifecycle and financial backfills", () => {
    const legacyTimestampCast =
      "nullif(btrim(student.createdat::text), '')::timestamptz";

    expect(lifecycleMigrationSource).toContain(legacyTimestampCast);
    expect(migrationSource).toContain(legacyTimestampCast);
    expect(lifecycleMigrationSource).not.toContain(
      "coalesce(student.createdat, now())"
    );
    expect(migrationSource).not.toContain(
      "coalesce(student.createdat, now())"
    );
  });

  test("moves the real status behind a financial-permission RLS policy", () => {
    expect(migrationSource).toContain(
      "create table public.student_financial_statuses"
    );
    expect(migrationSource).toContain(
      "alter table public.student_financial_statuses enable row level security"
    );
    expect(migrationSource).toContain(
      "using (public.has_org_member_permission(organization_id, 'financial'))"
    );
    expect(migrationSource).toContain(
      "revoke all on table public.student_financial_statuses from public, anon, authenticated"
    );
    expect(migrationSource).toContain(
      "grant select on table public.student_financial_statuses to authenticated"
    );
  });

  test("leaves only a sanitized compatibility value on the general students row", () => {
    expect(migrationSource).toMatch(
      /update public\.students\s+set financial_status = 'unknown'/
    );
    expect(migrationSource).toContain("check (financial_status = 'unknown')");
    expect(migrationSource).toContain(
      "new.financial_status := 'unknown'"
    );
    expect(migrationSource).toContain(
      "Sensitive financial state remains in public.students"
    );
  });

  test("hydrates authorized reads and sends updates through the protected RPC", () => {
    expect(studentsSource).toContain(
      "/student_financial_statuses?select=student_id,status"
    );
    expect(studentsSource).toContain(
      '"/rpc/set_student_financial_status"'
    );
    expect(studentsSource).not.toContain(
      "payload.financial_status = patch.financialStatus"
    );
    expect(studentsSource).toContain('financial_status: "unknown"');
    expect(roleSource).toContain('financialStatus: "unknown"');
  });

  test("never persists hydrated financial values in the shared students cache", () => {
    const cacheWrite = studentsSource.indexOf(
      "await writeCache(cacheKey, safeMapped)"
    );
    const hydration = studentsSource.indexOf(
      "const mapped = await hydrateStudentFinancialStatuses"
    );
    expect(cacheWrite).toBeGreaterThan(-1);
    expect(hydration).toBeGreaterThan(cacheWrite);
    expect(studentsSource).toContain(
      "sanitizeCachedStudentFinancialStatuses(cached)"
    );
  });

  test("keeps the write RPC authenticated, scoped and permission checked", () => {
    const rpcSource = migrationSource.slice(
      migrationSource.indexOf(
        "create or replace function public.set_student_financial_status"
      ),
      migrationSource.indexOf(
        "revoke all on function public.set_student_financial_status"
      )
    );
    expect(rpcSource).toContain("v_actor_user_id uuid := auth.uid()");
    expect(rpcSource).toContain(
      "public.has_org_member_permission(p_org_id, 'financial')"
    );
    expect(rpcSource).toContain(
      "from public.organization_members member"
    );
    expect(rpcSource).toContain(
      "from public.organization_member_permissions permission"
    );
    expect(rpcSource).toContain("where student.id = p_student_id");
    expect(rpcSource).toContain(
      "v_student_org_id is distinct from p_org_id"
    );
    expect(rpcSource).toContain("for update");
    expect(rpcSource).toContain(
      "on conflict on constraint student_financial_statuses_pkey"
    );
    expect(rpcSource).not.toContain("on conflict (student_id)");
  });

  test("indexes each new financial foreign-key access path", () => {
    expect(migrationSource).toContain(
      "student_financial_statuses_org_student_idx"
    );
    expect(migrationSource).toContain(
      "student_financial_statuses_updated_by_idx"
    );
  });
});
