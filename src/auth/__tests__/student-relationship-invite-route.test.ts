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
const verifyEmailSource = readFileSync(
  resolve(__dirname, "../../../app/verify-email.tsx"),
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
    const publicPrefixes = layoutSource.match(/const publicPrefixes = \[([^\]]+)\]/)?.[1]
      .match(/"([^"]+)"/g)?.map((value) => JSON.parse(value));
    expect(publicPrefixes).toEqual(expect.arrayContaining(["/invite", "/family-invite"]));
    expect(routeSource).toContain("validateStudentRelationshipInvite(tokenValue)");
    expect(routeSource).not.toContain('from "../../src/api/student-invite"');
  });

  it("delegates login, account creation and e-mail verification to the canonical auth screens", () => {
    expect(routeSource).toContain('router.push("/signup")');
    expect(routeSource).toContain('router.push("/login")');
    expect(routeSource).toContain('pathname: "/verify-email"');
    expect(routeSource).not.toContain("await signIn(");
    expect(routeSource).not.toContain("await signUp(");
    expect(routeSource).not.toContain("await verifySignupCode(");
    expect(routeSource).not.toContain("<TextInput");
    expect(routeSource).toContain("requiresInviteEmailVerification(session?.user)");
    expect(routeSource).toContain("claimStudentRelationshipInvite(tokenValue)");
  });

  it("returns each accepted relationship to its authorized portal", () => {
    expect(routeSource).toContain('receipt.relationshipKind === "athlete"');
    expect(routeSource).toContain('"/student/home" : "/family/home"');
    expect(routeSource).toContain("await Promise.all([refreshUser(), refreshRole()])");
  });

  it("claims a pending family relationship immediately after OTP verification", () => {
    const claimIndex = verifyEmailSource.indexOf(
      "claimStudentRelationshipInvite(relationshipToken)",
    );
    const clearIndex = verifyEmailSource.indexOf(
      "clearPendingRelationshipInvite()",
    );

    expect(claimIndex).toBeGreaterThan(-1);
    expect(clearIndex).toBeGreaterThan(claimIndex);
    expect(verifyEmailSource).toContain('receipt.relationshipKind === "athlete"');
    expect(verifyEmailSource).toContain('"/student/home" : "/family/home"');
    expect(verifyEmailSource).toContain("await Promise.all([refreshUser(), refreshRole()])");
    expect(verifyEmailSource).toContain('pendingRelationshipToken: ""');
  });

  it("keeps only the compact invite context and persists the return path", () => {
    expect(routeSource).toContain("maxWidth: 440");
    expect(routeSource).toContain("savePendingRelationshipInvite(tokenValue)");
    expect(routeSource).toContain("clearPendingRelationshipInvite()");
    expect(routeSource).not.toContain("type AuthStep");
    expect(routeSource).not.toContain("inputShell");
  });
});
