import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

const createSource = read("../../create-student-relationship-invite/index.ts");
const validateSource = read("../../validate-student-relationship-invite/index.ts");
const claimSource = read("../../claim-student-relationship-invite/index.ts");
const helperSource = read("../student-relationship-invite.ts");
const verificationSource = read("../invite-email-verification.ts");
const migrationSource = read(
  "../../../migrations/20260831005113_family_access_foundation.sql",
);
const configSource = read("../../../config.toml");

describe("student relationship invite Edge Function contract", () => {
  test("generates opaque tokens and persists only their SHA-256 hashes", () => {
    expect(helperSource).toContain(
      "crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))",
    );
    expect(helperSource).toContain('crypto.subtle.digest("SHA-256", data)');
    expect(helperSource).toContain("const TOKEN_BYTES = 32");
    expect(createSource).toContain(
      "generateStudentRelationshipInviteToken()",
    );
    expect(createSource).toContain(
      "hashStudentRelationshipInviteToken(token)",
    );
    expect(createSource).toContain("p_token_hash: tokenHash");
    expect(createSource).not.toMatch(/p_token:\s*token/);
    expect(createSource).not.toContain("console.log");
  });

  test("creates invitations through the caller JWT and the atomic RPC", () => {
    expect(createSource).toContain("await authenticateRequest(req)");
    expect(createSource).toContain("Authorization: `Bearer ${auth.token}`");
    expect(createSource).toContain(
      '.rpc("create_student_relationship_invite_v1"',
    );
    expect(createSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(createSource).not.toMatch(/\.from\(["']student_relationship_invites/);
    expect(createSource).toContain(
      "JSON.stringify({ inviteId, expiresAt, token, inviteUrl })",
    );
  });

  test("validates through a service-role-only RPC and exposes an allowlisted preview", () => {
    expect(validateSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(validateSource).toContain(
      '.rpc("validate_student_relationship_invite_v1"',
    );
    expect(validateSource).not.toMatch(/\.from\(["']student_relationship_invites/);
    expect(validateSource).toContain("const sanitizedPreview");
    expect(validateSource).not.toContain("invited_email");

    const validateGrant = migrationSource.slice(
      migrationSource.indexOf(
        "revoke all on function public.validate_student_relationship_invite_v1",
      ),
      migrationSource.indexOf(
        "create or replace function public.claim_student_relationship_invite_v1",
      ),
    );
    expect(validateGrant).toContain("to service_role");
    expect(validateGrant).not.toContain("to authenticated");
  });

  test("derives claim identity from a verified bearer user, never request fields", () => {
    expect(claimSource).toContain("await authenticateRequest(req)");
    expect(claimSource).toContain("hasTrustedInviteIdentity(user)");
    expect(verificationSource).toContain("user.app_metadata");
    expect(claimSource).toContain("p_user_id: user.id");
    expect(claimSource).toContain("p_user_email: verifiedEmail");
    expect(claimSource).not.toContain("payload.userId");
    expect(claimSource).not.toContain("payload.userEmail");
    expect(claimSource).not.toContain("user.user_metadata");
    expect(claimSource).toContain(
      '"claim_student_relationship_invite_v1"',
    );
    expect(claimSource).not.toMatch(/\.from\(["']student_relationship_invites/);
  });

  test("never logs bearer identity, token, payload or provider errors", () => {
    for (const source of [createSource, validateSource, claimSource]) {
      expect(source).not.toContain("console.log");
      expect(source).not.toMatch(/console\.error\([^)]*(token|payload|user|email|error)/i);
      expect(source).not.toContain("JSON.stringify(payload)");
      expect(source).not.toContain("auth.token)");
    }
  });

  test("keeps gateway JWT parsing disabled while enforcing authentication internally", () => {
    for (const functionName of [
      "create-student-relationship-invite",
      "validate-student-relationship-invite",
      "claim-student-relationship-invite",
    ]) {
      expect(configSource).toContain(
        `[functions.${functionName}]\nverify_jwt = false`,
      );
    }
    expect(createSource).toContain("await authenticateRequest(req)");
    expect(claimSource).toContain("await authenticateRequest(req)");
    expect(validateSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
