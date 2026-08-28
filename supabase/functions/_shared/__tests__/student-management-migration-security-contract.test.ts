import { readFileSync } from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve(__dirname, "..", "..", "..", "migrations");

const lifecycleMigration = readFileSync(
  path.join(
    migrationsDir,
    "20260825211640_student_lifecycle_financial_history.sql"
  ),
  "utf8"
);

const coverageHardeningMigration = readFileSync(
  path.join(
    migrationsDir,
    "20260826083000_harden_class_session_coverage_updates.sql"
  ),
  "utf8"
);

const coverageInsertDeleteHardeningMigration = readFileSync(
  path.join(
    migrationsDir,
    "20260826085000_harden_class_session_coverage_insert_delete.sql"
  ),
  "utf8"
);

describe("student management migration security", () => {
  test("does not let a deleted actor weaken idempotency ownership", () => {
    const accessChangeFunction = lifecycleMigration.slice(
      lifecycleMigration.indexOf(
        "create or replace function public.admin_apply_member_access_change_v2"
      ),
      lifecycleMigration.indexOf(
        "revoke all on function public.admin_apply_member_access_change_v2"
      )
    );

    expect(accessChangeFunction).toContain(
      "v_existing.organization_id is distinct from p_org_id"
    );
    expect(accessChangeFunction).toContain(
      "v_existing.target_user_id is distinct from p_user_id"
    );
    expect(accessChangeFunction).toContain(
      "v_existing.actor_user_id is distinct from v_actor_user_id"
    );
    expect(accessChangeFunction).not.toContain(
      "v_existing.actor_user_id <> v_actor_user_id"
    );
  });

  test("requires the students permission before moving enrollments", () => {
    const moveFunction = lifecycleMigration.slice(
      lifecycleMigration.indexOf(
        "create or replace function public.move_students_to_class"
      ),
      lifecycleMigration.indexOf(
        "revoke all on function public.move_students_to_class"
      )
    );

    expect(moveFunction).toContain(
      "public.has_org_member_permission(p_org_id, 'students')"
    );
    expect(moveFunction).toContain("public.is_class_staff(p_from_class_id)");
    expect(moveFunction).toContain("public.is_class_staff(p_to_class_id)");
  });

  test("checks coverage UPDATE access against both old and proposed rows", () => {
    const withCheck = coverageHardeningMigration.slice(
      coverageHardeningMigration.indexOf("with check (")
    );

    expect(coverageHardeningMigration).toContain("to authenticated");
    expect(coverageHardeningMigration).toContain("using (");
    expect(withCheck).toContain("public.is_org_member(organization_id)");
    expect(withCheck).toContain("public.is_org_admin(organization_id)");
    expect(withCheck).toContain("class_session_coverages.organization_id");
    expect(withCheck).toContain("class_session_coverages.class_id");
    expect(withCheck).toContain("staff.staff_role in ('head', 'assistant')");
  });

  test("correlates coverage INSERT and DELETE access with the outer row", () => {
    const insertPolicy = coverageInsertDeleteHardeningMigration.slice(
      coverageInsertDeleteHardeningMigration.indexOf(
        "create policy class_session_coverages_insert"
      ),
      coverageInsertDeleteHardeningMigration.indexOf(
        "drop policy if exists class_session_coverages_delete"
      )
    );
    const deletePolicy = coverageInsertDeleteHardeningMigration.slice(
      coverageInsertDeleteHardeningMigration.indexOf(
        "create policy class_session_coverages_delete"
      )
    );

    expect(insertPolicy).toContain("to authenticated");
    expect(insertPolicy).toContain(
      "public.is_org_member(class_session_coverages.organization_id)"
    );
    expect(insertPolicy).toContain(
      "class_row.id = class_session_coverages.class_id"
    );
    expect(insertPolicy).toContain(
      "class_row.organization_id = class_session_coverages.organization_id"
    );
    expect(insertPolicy).toContain(
      "staff.organization_id = class_session_coverages.organization_id"
    );
    expect(insertPolicy).toContain(
      "staff.class_id = class_session_coverages.class_id"
    );

    expect(deletePolicy).toContain("to authenticated");
    expect(deletePolicy).toContain(
      "public.is_org_member(class_session_coverages.organization_id)"
    );
    expect(deletePolicy).toContain(
      "staff.organization_id = class_session_coverages.organization_id"
    );
    expect(deletePolicy).toContain(
      "staff.class_id = class_session_coverages.class_id"
    );
  });
});
