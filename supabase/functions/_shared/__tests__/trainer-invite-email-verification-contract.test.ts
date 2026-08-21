import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const verifySource = readFileSync(
  resolve(__dirname, "../../verify-signup-email-code/index.ts"),
  "utf8"
);
const claimSource = readFileSync(
  resolve(__dirname, "../../claim-trainer-invite/index.ts"),
  "utf8"
);
const signupSource = readFileSync(resolve(__dirname, "../../../../app/signup.tsx"), "utf8");
const verifyScreenSource = readFileSync(
  resolve(__dirname, "../../../../app/verify-email.tsx"),
  "utf8"
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
    expect(claimSource).toContain("user.app_metadata");
    expect(claimSource).toContain("EMAIL_NOT_VERIFIED");
    expect(claimSource).not.toContain("user.user_metadata");
  });

  test("keeps the invite pending until the verified pending route claims it", () => {
    expect(signupSource).toContain("savePendingTrainerInvite");
    expect(signupSource).not.toContain("claimTrainerInvite");
    expect(verifyScreenSource).toContain('router.replace("/pending")');
    expect(verifyScreenSource).not.toContain("claimTrainerInvite");
  });

  test("sends the first hybrid verification code during signup", () => {
    expect(signupSource).toContain("resendSignupCode");
    expect(signupSource).toContain(
      'await resendSignupCode(normalizedEmail, "verify-email")'
    );
    expect(signupSource).toContain('delivery: initialCodeDeliveryFailed ? "failed" : undefined');
  });
});
