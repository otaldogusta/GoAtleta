import { readFileSync } from "node:fs";
import path from "node:path";

const migrationSource = readFileSync(
  path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "migrations",
    "20260812023820_reconcile_planning_identity_and_document_application.sql"
  ),
  "utf8"
);

describe("planning identity migration contract", () => {
  test("repairs the canonical planning columns before reconciling rows", () => {
    const compatibilityStart = migrationSource.indexOf(
      "alter table public.planning_cycles"
    );
    const reconciliationStart = migrationSource.indexOf(
      "insert into public.planning_cycles"
    );

    expect(compatibilityStart).toBeGreaterThanOrEqual(0);
    expect(compatibilityStart).toBeLessThan(reconciliationStart);
    expect(migrationSource).toContain("add column if not exists start_date date");
    expect(migrationSource).toContain("add column if not exists end_date date");
    expect(migrationSource).toContain("add column if not exists cycle_id text");
    expect(migrationSource).toContain("add column if not exists created_at timestamptz");
  });

  test("creates the workspace cycle identity used by ON CONFLICT", () => {
    expect(migrationSource).toContain(
      "on public.planning_cycles (organization_id, classid, year)"
    );
    expect(migrationSource).toContain(
      "on conflict (organization_id, classid, year) do nothing"
    );
    expect(migrationSource).toContain(
      "planning_cycles contains duplicate organization/class/year identities"
    );
  });

  test("audits losing weekly plans before deleting true duplicates", () => {
    expect(migrationSource).toContain("private.planning_reconciliation_audit");
    expect(migrationSource).toContain("to_jsonb(losers)");
    expect(migrationSource.indexOf("insert into private.planning_reconciliation_audit")).toBeLessThan(
      migrationSource.indexOf("delete from public.class_plans")
    );
  });

  test("requires every weekly plan to belong to its class workspace cycle", () => {
    expect(migrationSource).toContain("alter column cycle_id set not null");
    expect(migrationSource).toContain("class_plans_cycle_workspace_fk");
    expect(migrationSource).toContain("unique (id, classid, organization_id)");
    expect(migrationSource).toContain(
      "on public.class_plans (organization_id, classid, cycle_id, weeknumber)"
    );
  });

  test("records application separately from the versioned document", () => {
    expect(migrationSource).toContain("public.training_plan_applications");
    expect(migrationSource).toContain("training_plan_applications_class_workspace_fk");
    expect(migrationSource).toContain("public.capture_training_plan_application()");
    expect(migrationSource).toContain("training_plans_capture_application");
  });

  test("keeps application rows isolated by organization and class staff", () => {
    expect(migrationSource).toContain("public.is_org_member(organization_id)");
    expect(migrationSource).toContain("public.is_class_staff(class_id)");
    expect(migrationSource).toContain("revoke all on table public.training_plan_applications from anon");
  });
});
