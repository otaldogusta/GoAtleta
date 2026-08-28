import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const createSource = readFileSync(
  resolve(__dirname, "../../create-trainer-invite/index.ts"),
  "utf8"
);
const listSource = readFileSync(
  resolve(__dirname, "../../list-trainer-invites/index.ts"),
  "utf8"
);
const revokeSource = readFileSync(
  resolve(__dirname, "../../revoke-trainer-invite/index.ts"),
  "utf8"
);
const migrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../migrations/20260825211521_harden_invite_revocation_and_member_removal.sql"
  ),
  "utf8"
);
const financialPermissionMigrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../migrations/20260825212548_include_financial_permission_in_trainer_invites.sql"
  ),
  "utf8"
);
const atomicInviteMigrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../migrations/20260825214632_atomic_student_invite_claim.sql"
  ),
  "utf8"
);

describe("trainer invite revocation and member removal contract", () => {
  it("creates only single-use invitations", () => {
    expect(createSource).toContain("const maxUses = 1;");
    expect(migrationSource).toContain("trainer_invites_enforce_single_use");
    expect(migrationSource).toContain("before insert on public.trainer_invites");
    expect(migrationSource).toContain(
      "Trainer invitations must be single-use"
    );
    expect(migrationSource).not.toMatch(
      /add constraint trainer_invites_single_use_check[\s\S]*not valid/
    );
  });

  it("keeps invitation mutations behind Edge or service-role callers", () => {
    expect(migrationSource).toMatch(
      /revoke insert, update, delete on table public\.trainer_invites\s+from anon, authenticated;/
    );
    expect(migrationSource).toMatch(
      /revoke insert, update, delete on table public\.student_invites\s+from anon, authenticated;/
    );
    expect(migrationSource).toContain(
      'drop policy if exists "trainer_invites insert trainer"'
    );
    expect(migrationSource).toContain(
      'drop policy if exists "student_invites update trainer"'
    );
  });

  it("keeps financial access opt-in for non-admin invitations", () => {
    expect(createSource).toContain('"financial"');
    expect(createSource).toContain(
      "Array.isArray(payload.permissionKeys) ? payload.permissionKeys : []"
    );
    expect(atomicInviteMigrationSource).toContain("invite.initial_permissions");
    expect(financialPermissionMigrationSource).toContain("'financial'");
    expect(financialPermissionMigrationSource).toContain(
      "v_invite.initial_permissions ? v_permission_key"
    );
  });

  it("records and lists who cancelled an invitation", () => {
    expect(revokeSource).toContain('"revoke_trainer_invite_access"');
    expect(revokeSource).not.toContain('.from("trainer_invites")');
    expect(atomicInviteMigrationSource).toContain(
      "create or replace function public.revoke_trainer_invite_access"
    );
    expect(atomicInviteMigrationSource).toContain("revoked_at = now()");
    expect(atomicInviteMigrationSource).toContain("revoked_by = auth.uid()");
    expect(atomicInviteMigrationSource).toContain("invite.revoked_at");
    expect(atomicInviteMigrationSource).toContain("invite.revoked_by");
    expect(listSource).not.toContain('.eq("revoked", false)');
    expect(migrationSource).toContain("trainer_invites_stamp_revocation");
    expect(migrationSource).toContain("trainer_invites_revoked_by_idx");
  });

  it("creates trainer invitations in a JWT-scoped transaction", () => {
    expect(createSource).toContain('rpc("create_trainer_invite_access"');
    expect(createSource).not.toContain('.from("trainer_invites").insert');
    expect(atomicInviteMigrationSource).toContain(
      "create or replace function public.create_trainer_invite_access"
    );
    expect(atomicInviteMigrationSource).toContain(
      "from public.organization_members member"
    );
    expect(atomicInviteMigrationSource).toContain("member.user_id = auth.uid()");
  });

  it("lists trainer invitations through a JWT-scoped RPC", () => {
    expect(listSource).toContain('"list_trainer_invites_access"');
    expect(listSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(listSource).not.toContain('.from("trainer_invites")');
    expect(atomicInviteMigrationSource).toContain(
      "create or replace function public.list_trainer_invites_access"
    );
    expect(atomicInviteMigrationSource).toContain("for share");
  });

  it("rejects non-object JSON in trainer invitation management", () => {
    for (const source of [createSource, listSource, revokeSource]) {
      expect(source).toContain("validateObjectPayload(await req.json())");
      expect(source).toContain("!parsed.ok || !parsed.data");
    }
  });

  it("removes organization-scoped staff and permission access atomically", () => {
    const removalFunction = migrationSource.slice(
      migrationSource.indexOf(
        "create or replace function public.admin_remove_org_member"
      )
    );
    const staffCleanup = migrationSource.indexOf("delete from public.class_staff staff");
    const permissionCleanup = migrationSource.lastIndexOf(
      "delete from public.organization_member_permissions permission"
    );
    const membershipCleanup = migrationSource.indexOf(
      "delete from public.organization_members member"
    );

    expect(staffCleanup).toBeGreaterThan(-1);
    expect(permissionCleanup).toBeGreaterThan(staffCleanup);
    expect(membershipCleanup).toBeGreaterThan(permissionCleanup);
    expect(migrationSource).toContain("class_staff_membership_fkey");
    expect(migrationSource).toContain("organization_member_permissions_membership_fkey");
    expect(migrationSource).toContain("not valid");
    expect(migrationSource).toContain("classes.owner_id = auth.uid()");
    expect(migrationSource).toContain("public.is_org_member(classes.organization_id)");
    const organizationLock = removalFunction.indexOf(
      "from public.organizations organization"
    );
    const firstAuthorization = removalFunction.indexOf(
      "if not public.is_org_admin(p_org_id)"
    );
    const authorizationRecheck = removalFunction.indexOf(
      "if not public.is_org_admin(p_org_id)",
      firstAuthorization + 1
    );
    expect(firstAuthorization).toBeGreaterThan(-1);
    expect(organizationLock).toBeGreaterThan(firstAuthorization);
    expect(removalFunction.indexOf("for update", organizationLock)).toBeGreaterThan(
      organizationLock
    );
    expect(authorizationRecheck).toBeGreaterThan(organizationLock);
  });

  it("archives stale permission overrides before a removed member re-enters", () => {
    const permissionForeignKey = migrationSource.indexOf(
      "add constraint organization_member_permissions_membership_fkey"
    );
    const legacyArchive = migrationSource.indexOf(
      "'orphaned_before_membership_fk'"
    );
    const legacyDelete = migrationSource.indexOf(
      "delete from public.organization_member_permissions permission",
      legacyArchive
    );
    const foreignKeyValidation = migrationSource.indexOf(
      "validate constraint organization_member_permissions_membership_fkey"
    );

    expect(migrationSource).toContain(
      "private.orphaned_member_permission_archive"
    );
    expect(migrationSource).toContain(
      "organization_members_archive_stale_permissions"
    );
    expect(migrationSource).toMatch(
      /if exists \([\s\S]*from public\.organization_members member/
    );
    expect(migrationSource).toContain(
      "delete from public.organization_member_permissions permission"
    );
    expect(permissionForeignKey).toBeGreaterThan(-1);
    expect(legacyArchive).toBeGreaterThan(permissionForeignKey);
    expect(legacyDelete).toBeGreaterThan(legacyArchive);
    expect(foreignKeyValidation).toBeGreaterThan(legacyDelete);
  });

  it("requires current organization membership for class staff authorization", () => {
    const staffAuthorization = migrationSource.slice(
      migrationSource.indexOf(
        "create or replace function public.is_class_staff"
      ),
      migrationSource.indexOf(
        "create or replace function public.is_class_head"
      )
    );
    const headAuthorization = migrationSource.slice(
      migrationSource.indexOf(
        "create or replace function public.is_class_head"
      ),
      migrationSource.indexOf(
        "drop policy if exists \"org_member_permissions select own_or_admin\""
      )
    );

    expect(staffAuthorization).toContain(
      "join public.organization_members member"
    );
    expect(headAuthorization).toContain(
      "join public.organization_members member"
    );
    expect(staffAuthorization).toContain(
      "class_group.organization_id = staff.organization_id"
    );
    expect(headAuthorization).toContain("staff.staff_role = 'head'");
  });
});
