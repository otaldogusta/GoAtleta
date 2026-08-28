import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const claimSource = readFileSync(
  resolve(__dirname, "../../claim-student-invite/index.ts"),
  "utf8"
);
const autoLinkSource = readFileSync(
  resolve(__dirname, "../../auto-link-student/index.ts"),
  "utf8"
);
const verificationSource = readFileSync(
  resolve(__dirname, "../invite-email-verification.ts"),
  "utf8"
);
const revokeSource = readFileSync(
  resolve(__dirname, "../../revoke-student-access/index.ts"),
  "utf8"
);
const createInviteSource = readFileSync(
  resolve(__dirname, "../../create-student-invite/index.ts"),
  "utf8"
);
const listInvitesSource = readFileSync(
  resolve(__dirname, "../../list-student-invites/index.ts"),
  "utf8"
);
const revokeInviteSource = readFileSync(
  resolve(__dirname, "../../revoke-student-invite/index.ts"),
  "utf8"
);
const accessRequestSource = readFileSync(
  resolve(__dirname, "../../request-access-review/index.ts"),
  "utf8"
);
const inviteScreenSource = readFileSync(
  resolve(__dirname, "../../../../app/invite/[token].tsx"),
  "utf8"
);
const verifyScreenSource = readFileSync(
  resolve(__dirname, "../../../../app/verify-email.tsx"),
  "utf8"
);
const migrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../migrations/20260825214632_atomic_student_invite_claim.sql"
  ),
  "utf8"
);

describe("student invite security contract", () => {
  test("links the athlete and consumes the invite in one database transaction", () => {
    expect(claimSource).toContain('rpc(\n    "claim_student_invite_access"');
    expect(claimSource).not.toContain('.from("student_invites")');
    expect(migrationSource).toContain("for update");
    expect(migrationSource).toContain("update public.students student");
    expect(migrationSource).toContain("update public.student_invites invite");
    expect(migrationSource).toContain("to service_role");
    expect(migrationSource).toContain("from public, anon, authenticated");
    expect(migrationSource).toContain("create or replace function public.revoke_student_access");
    expect(revokeSource).toContain('rpc("revoke_student_access"');
    expect(revokeSource).not.toContain('.from("student_invites")');
  });

  test("requires trusted server-managed verification before linking", () => {
    expect(claimSource).toContain("hasTrustedInviteIdentity(user)");
    expect(claimSource).not.toContain("user.user_metadata");
    expect(verificationSource).toContain("user.app_metadata");
    expect(verificationSource).toContain("TRUSTED_EXTERNAL_PROVIDERS");
    expect(verificationSource).toContain("email_verified_hybrid_at");
    expect(autoLinkSource).toContain("raw_app_meta_data");
    expect(autoLinkSource).toContain("email_verified_hybrid_at");
    expect(autoLinkSource).toContain(
      "Boolean(appMetadata.email_verified_hybrid_at.trim())"
    );
    expect(autoLinkSource).toContain('reason: "email_not_verified"');
  });

  test("keeps student invite management in JWT-scoped database transactions", () => {
    expect(createInviteSource).toContain('rpc("create_student_invite_access"');
    expect(createInviteSource).not.toContain('.from("student_invites").insert');
    expect(listInvitesSource).toContain('"list_student_invites_access"');
    expect(listInvitesSource).not.toContain('.from("student_invites")');
    expect(revokeInviteSource).toContain('"revoke_student_invite_access"');
    expect(revokeInviteSource).not.toContain('.from("student_invites")');
    expect(migrationSource).toContain(
      "create or replace function public.create_student_invite_access"
    );
    expect(migrationSource).toContain(
      "create or replace function public.list_student_invites_access"
    );
    expect(migrationSource).toContain(
      "create or replace function public.revoke_student_invite_access"
    );
  });

  test("rejects non-object JSON before reading invitation fields", () => {
    for (const source of [
      claimSource,
      createInviteSource,
      revokeInviteSource,
      revokeSource,
    ]) {
      expect(source).toContain("validateObjectPayload(await req.json())");
      expect(source).toContain("!parsed.ok || !parsed.data");
    }
  });

  test("rejects athlete self-service and blocks class staff with students=false", () => {
    const managerFunction = migrationSource.slice(
      migrationSource.indexOf(
        "create or replace function public.can_manage_student_invites"
      ),
      migrationSource.indexOf('create policy "student_invites select own"')
    );
    const createFunction = migrationSource.slice(
      migrationSource.indexOf(
        "create or replace function public.create_student_invite_access"
      ),
      migrationSource.indexOf(
        "create or replace function public.list_student_invites_access"
      )
    );

    expect(managerFunction).toContain(
      "public.has_org_member_permission(p_org_id, 'students')"
    );
    expect(managerFunction).toContain("public.is_org_admin(p_org_id)");
    expect(managerFunction).toContain("public.is_class_staff(student.classid)");
    expect(createFunction).toContain("if v_student.student_user_id is not null");
    expect(createFunction).toContain("raise exception 'STUDENT_ALREADY_LINKED'");
    expect(createInviteSource).not.toContain('.from("students")');
    expect(createFunction.indexOf("public.can_manage_student_invites")).toBeLessThan(
      createFunction.indexOf("if v_student.student_user_id is not null")
    );
  });

  test("lets an authorized admin list cross-creator invitations in the organization", () => {
    const listFunction = migrationSource.slice(
      migrationSource.indexOf(
        "create or replace function public.list_student_invites_access"
      ),
      migrationSource.indexOf(
        "create or replace function public.revoke_student_invite_access"
      )
    );

    expect(listFunction).toContain("invite.organization_id = p_org_id");
    expect(listFunction).toContain("if p_org_id is null");
    expect(listFunction).toContain("public.can_manage_student_invites");
    expect(listFunction).not.toContain("invite.created_by = auth.uid()");
    expect(listInvitesSource).toContain("minLength: 36");
  });

  test("validates hashes and keeps invitation identity immutable", () => {
    expect(migrationSource.match(/\^\[0-9a-f\]\{64\}\$/g)).toHaveLength(3);
    expect(migrationSource).toContain("INVITE_DESTINATION_INVALID");
    expect(migrationSource).toContain("INVITE_IDENTITY_IMMUTABLE");
    expect(migrationSource).toContain(
      "new.student_id is distinct from old.student_id"
    );
    expect(migrationSource).toContain(
      "new.organization_id is distinct from old.organization_id"
    );
    expect(migrationSource).toContain("student_invites_revoked_by_idx");
  });

  test("serializes every athlete-link mutation with one advisory lock order", () => {
    const operations = [
      ["create_student_invite_access", "list_student_invites_access"],
      ["revoke_student_invite_access", "claim_student_invite_access"],
      ["claim_student_invite_access", "revoke_student_access"],
      ["revoke_student_access", "create_trainer_invite_access"],
    ];

    for (const [operation, nextOperation] of operations) {
      const start = migrationSource.indexOf(`function public.${operation}`);
      const nextStart = migrationSource.indexOf(
        `function public.${nextOperation}`,
        start + 1
      );
      const body = migrationSource.slice(start, nextStart);
      expect(body).toContain("pg_advisory_xact_lock");
      expect(body.indexOf("pg_advisory_xact_lock")).toBeLessThan(
        body.indexOf("for update")
      );
    }
  });

  test("preserves the invite across hybrid email verification", () => {
    expect(inviteScreenSource).toContain("savePendingInvite");
    expect(inviteScreenSource).toContain("resendSignupCode");
    expect(inviteScreenSource).toContain('pathname: "/verify-email"');
    expect(verifyScreenSource).toContain("getPendingInvite()");
    expect(verifyScreenSource).toContain('router.replace("/pending")');
  });

  test("does not reveal whether the requested coordinator address matched", () => {
    expect(accessRequestSource).toContain("{ accepted: true }");
    expect(accessRequestSource).not.toContain("createdCount");
    expect(accessRequestSource).not.toMatch(/accepted:\s*true,\s*created:/);
    expect(accessRequestSource).toContain("resolve_access_request_coordinator");
    expect(migrationSource).toContain("notifications_access_request_delivery_uidx");
  });
});
