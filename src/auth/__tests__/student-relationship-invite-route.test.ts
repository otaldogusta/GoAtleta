import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSource = readFileSync(
  resolve(__dirname, "../../../app/family-invite/[token].tsx"),
  "utf8",
);
const layoutSource = readFileSync(
  resolve(__dirname, "../../../app/_layout.tsx"),
  "utf8",
);
const helperSource = readFileSync(
  resolve(
    __dirname,
    "../../../supabase/functions/_shared/student-relationship-invite.ts",
  ),
  "utf8",
);

describe("student relationship invite route contract", () => {
  it("uses a dedicated public route without touching the legacy invite path", () => {
    expect(helperSource).toContain(
      "`/family-invite/${encodeURIComponent(token)}`",
    );
    expect(layoutSource).toContain('["/invite", "/family-invite"]');
    expect(routeSource).toContain("validateStudentRelationshipInvite(tokenValue)");
    expect(routeSource).not.toContain('from "../../src/api/student-invite"');
  });

  it("covers login, account creation and trusted e-mail verification", () => {
    expect(routeSource).toContain("await signIn(");
    expect(routeSource).toContain("await signUp(");
    expect(routeSource).toContain("await verifySignupCode(");
    expect(routeSource).toContain("requiresInviteEmailVerification(session?.user)");
    expect(routeSource).toContain("claimStudentRelationshipInvite(tokenValue)");
  });

  it("returns each accepted relationship to its authorized portal", () => {
    expect(routeSource).toContain('receipt.relationshipKind === "athlete"');
    expect(routeSource).toContain('"/student/home" : "/family/home"');
    expect(routeSource).toContain("await Promise.all([refreshUser(), refreshRole()])");
  });

  it("keeps the compact auth layout and input geometry", () => {
    expect(routeSource).toContain("maxWidth: 440");
    expect(routeSource).toContain("minHeight: 50");
    expect(routeSource).toContain("borderRadius: 0");
    expect(routeSource).toContain("disabled={!canSubmitAuth}");
  });

  it("replaces the removed web outline with a neutral theme focus border", () => {
    expect(routeSource).toContain("focusedInputField === field ? borders.focus : 1");
    expect(routeSource).toContain("focusedInputField === field ? colors.borderStrong : colors.border");
    expect(routeSource).toContain('onFocus={() => setFocusedInputField("otp")}');
    expect(routeSource).toContain('onFocus={() => setFocusedInputField("email")}');
    expect(routeSource).toContain('onFocus={() => setFocusedInputField("password")}');
    expect(routeSource).toContain('onFocus={() => setFocusedInputField("confirmPassword")}');
    expect(routeSource).not.toContain("focusedInputField === field ? colors.primaryBg");
  });
});
