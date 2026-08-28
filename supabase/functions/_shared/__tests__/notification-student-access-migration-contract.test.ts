import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const migrationsDirectory = resolve(__dirname, "../../../migrations");
const migrationSource = readFileSync(
  resolve(migrationsDirectory, "20260828131255_allow_linked_students_notification_access.sql"),
  "utf8"
);
const insertLockdownMigrationSource = readFileSync(
  resolve(
    migrationsDirectory,
    "20260828160000_route_notification_inserts_through_edge.sql"
  ),
  "utf8"
);
const linkedStudentClassHeadsMigrationSource = readFileSync(
  resolve(
    migrationsDirectory,
    "20260828173000_allow_linked_students_list_own_class_heads.sql"
  ),
  "utf8"
);
const orderedMigrationSource = readdirSync(migrationsDirectory)
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort()
  .map((fileName) => readFileSync(resolve(migrationsDirectory, fileName), "utf8"))
  .join("\n");

function policySource(policyName: string, nextPolicyName?: string) {
  const start = migrationSource.indexOf(`create policy "${policyName}"`);
  const end = nextPolicyName
    ? migrationSource.indexOf(`drop policy if exists "${nextPolicyName}"`, start)
    : migrationSource.length;

  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  return migrationSource.slice(start, end);
}

describe("linked student notification access migration", () => {
  test("keeps the organization lookup indexed and bound to the authenticated caller", () => {
    const helperStart = migrationSource.indexOf(
      "create or replace function public.is_org_member_or_linked_student"
    );
    const helperEnd = migrationSource.indexOf(
      "revoke all on function public.is_org_member_or_linked_student"
    );
    const helper = migrationSource.slice(helperStart, helperEnd);

    expect(migrationSource).toContain(
      "on public.students (organization_id, student_user_id)"
    );
    expect(helper).toContain("security invoker");
    expect(helper).toContain("set search_path = ''");
    expect(helper).not.toContain("set row_security = off");
    expect(helper).toContain("select (select auth.uid()) as user_id");
    expect(helper).toContain("select public.is_org_member(p_organization_id)");
    expect(helper).toContain("from public.students student");
    expect(helper).toContain("student.student_user_id = caller.user_id");
    expect(migrationSource).toMatch(
      /revoke all on function public\.is_org_member_or_linked_student\(uuid\)\s+from public, anon, authenticated;/
    );
    expect(migrationSource).toMatch(
      /grant execute on function public\.is_org_member_or_linked_student\(uuid\)\s+to authenticated;/
    );
  });

  test("keeps the linked student's self-select policy available to the invoker helper", () => {
    const lastDrop = orderedMigrationSource.lastIndexOf(
      'drop policy if exists "students select self" on public.students'
    );
    const lastCreate = orderedMigrationSource.lastIndexOf(
      'create policy "students select self" on public.students'
    );
    const policy = orderedMigrationSource.slice(lastCreate, lastCreate + 240);

    expect(lastCreate).toBeGreaterThan(lastDrop);
    expect(policy).toContain("student_user_id = auth.uid()");
  });

  const scopedPolicies: Array<[string, string | undefined, string]> = [
    ["notifications_select_own", "notifications_insert_own", "recipient_user_id"],
    ["notifications_update_read_own", "notifications_delete_own", "recipient_user_id"],
    ["notifications_delete_own", "push_tokens_select_own", "recipient_user_id"],
    ["push_tokens_select_own", "push_tokens_insert_own", "user_id"],
    ["push_tokens_insert_own", "push_tokens_update_own", "user_id"],
    ["push_tokens_update_own", "push_tokens_delete_own", "user_id"],
    ["push_tokens_delete_own", undefined, "user_id"],
  ];

  test.each(scopedPolicies)(
    "%s remains caller-owned and organization-scoped",
    (policyName, nextPolicyName, ownerColumn) => {
      const policy = policySource(policyName, nextPolicyName);

      expect(policy).toContain("to authenticated");
      expect(policy).toContain(`${ownerColumn} = (select auth.uid())`);
      expect(policy).toContain("public.is_org_member_or_linked_student(");
    }
  );

  test("UPDATE policies validate both the existing and proposed rows", () => {
    const updatePolicies: Array<[string, string]> = [
      ["notifications_update_read_own", "notifications_delete_own"],
      ["push_tokens_update_own", "push_tokens_delete_own"],
    ];

    for (const [policyName, nextPolicyName] of updatePolicies) {
      const policy = policySource(policyName, nextPolicyName);

      expect(policy).toContain("using (");
      expect(policy).toContain("with check (");
    }
  });

  test("does not grant linked athletes staff membership", () => {
    expect(migrationSource).not.toMatch(
      /insert\s+into\s+public\.organization_members/i
    );
  });

  test("lets linked athletes resolve heads only for their own active classes", () => {
    expect(linkedStudentClassHeadsMigrationSource).toContain(
      "create or replace function public.list_org_class_heads_for_classes"
    );
    expect(linkedStudentClassHeadsMigrationSource).toContain(
      "student.student_user_id = v_user_id"
    );
    expect(linkedStudentClassHeadsMigrationSource).toContain(
      "coalesce(student.membership_status, 'active') = 'active'"
    );
    expect(linkedStudentClassHeadsMigrationSource).toContain(
      "student.classid = cs.class_id"
    );
    expect(linkedStudentClassHeadsMigrationSource).toContain(
      "from public.student_class_enrollments enrollment"
    );
    expect(linkedStudentClassHeadsMigrationSource).toContain(
      "enrollment.status = 'active'"
    );
    expect(linkedStudentClassHeadsMigrationSource).toMatch(
      /revoke all on function public\.list_org_class_heads_for_classes\(uuid, text\[\]\)\s+from anon, public;/
    );
    expect(linkedStudentClassHeadsMigrationSource).toMatch(
      /grant execute on function public\.list_org_class_heads_for_classes\(uuid, text\[\]\)\s+to authenticated;/
    );
  });

  test("removes direct notification inserts and anonymous push-token access", () => {
    expect(insertLockdownMigrationSource).toContain(
      'drop policy if exists "notifications_insert_own" on public.notifications'
    );
    expect(insertLockdownMigrationSource).toContain(
      "revoke insert on table public.notifications from anon, authenticated"
    );
    expect(insertLockdownMigrationSource).toContain(
      "revoke all on table public.push_tokens from anon"
    );
  });
});
