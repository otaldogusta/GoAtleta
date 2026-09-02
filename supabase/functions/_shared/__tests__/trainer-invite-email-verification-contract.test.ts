import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const verifySource = readFileSync(
  resolve(__dirname, "../../verify-signup-email-code/index.ts"),
  "utf8",
);
const claimSource = readFileSync(
  resolve(__dirname, "../../claim-trainer-invite/index.ts"),
  "utf8",
);
const verificationSource = readFileSync(
  resolve(__dirname, "../invite-email-verification.ts"),
  "utf8",
);
const claimMigrationSource = readFileSync(
  resolve(
    __dirname,
    "../../../migrations/20260825212548_include_financial_permission_in_trainer_invites.sql",
  ),
  "utf8",
);
const signupSource = readFileSync(
  resolve(__dirname, "../../../../app/signup.tsx"),
  "utf8",
);
const verifyScreenSource = readFileSync(
  resolve(__dirname, "../../../../app/verify-email.tsx"),
  "utf8",
);

describe("trainer invite email verification contract", () => {
  test("records the OTP proof in server-managed app metadata", () => {
    expect(verifySource).toContain("auth.verifyOtp");
    expect(verifySource).toContain("auth.admin.updateUserById");
    expect(verifySource).toContain("app_metadata:");
    expect(verifySource).toContain('email_verification_source: "otp"');
    expect(verifySource).not.toContain("user_metadata:");
  });

  test("rejects invite claims without a trusted server-side verification", () => {
    expect(claimSource).toContain("hasTrustedInviteIdentity(user)");
    expect(claimSource).toContain("EMAIL_NOT_VERIFIED");
    expect(claimSource).not.toContain("user.user_metadata");
    expect(claimSource).toContain(
      "initial_permissions, invited_via, invited_to",
    );
    expect(claimSource).toContain(
      'invite.invited_via === "email" && invitedEmail && invitedEmail !== authenticatedEmail',
    );
    expect(verificationSource).toContain("user.app_metadata");
    expect(verificationSource).toContain("TRUSTED_EXTERNAL_PROVIDERS");
    expect(verificationSource).toContain("email_verified_hybrid_at");
    expect(claimMigrationSource).toContain("from auth.users account");
    expect(claimMigrationSource).toContain("v_invite.invited_via = 'email'");
    expect(claimMigrationSource).toContain("INVITE_EMAIL_MISMATCH");
  });

  test("rejects non-object JSON before reading the invitation code", () => {
    expect(claimSource).toContain("validateObjectPayload(await req.json())");
    expect(claimSource).toContain("!parsed.ok || !parsed.data");
  });

  test("keeps the invite pending until the verified pending route claims it", () => {
    expect(signupSource).toContain("savePendingTrainerInvite");
    expect(signupSource).not.toContain("claimTrainerInvite");
    expect(verifyScreenSource).toContain("resolvePendingInviteRedirect({");
    expect(verifyScreenSource).toContain("pendingTrainerCode,");
    expect(verifyScreenSource).toContain(
      "router.replace(pendingTarget as Parameters<typeof router.replace>[0])",
    );
    expect(verifyScreenSource).not.toContain("claimTrainerInvite");
  });

  test("sends the first hybrid verification code during signup", () => {
    expect(signupSource).toContain("resendSignupCode");
    expect(signupSource).toContain(
      'await resendSignupCode(normalizedEmail, "verify-email")',
    );
    expect(signupSource).toContain(
      'delivery: initialCodeDeliveryFailed ? "failed" : undefined',
    );
  });
});
