import {
  hasVerifiedEmailAccess,
  shouldRestrictToEmailVerification,
} from "../email-verification-state";

describe("trusted email verification state", () => {
  it("rejects an email/password session without server-recorded verification", () => {
    expect(hasVerifiedEmailAccess({
      app_metadata: { provider: "email", providers: ["email"] },
    })).toBe(false);
  });

  it("does not trust a client-controlled verification request marker", () => {
    expect(hasVerifiedEmailAccess({
      app_metadata: { provider: "email" },
      user_metadata: { requires_email_hybrid_verification: false },
    } as Parameters<typeof hasVerifiedEmailAccess>[0])).toBe(false);
  });

  it("accepts the server-recorded hybrid verification proof", () => {
    expect(hasVerifiedEmailAccess({
      app_metadata: {
        provider: "email",
        email_verified_hybrid_at: "2026-09-23T12:00:00.000Z",
      },
    })).toBe(true);
  });

  it.each(["google", "apple", "facebook"])("accepts trusted %s OAuth identity", (provider) => {
    expect(hasVerifiedEmailAccess({ identities: [{ provider }] })).toBe(true);
  });

  it.each(["/", "/pending", "/student/home", "/student/profile"])(
    "restricts an unverified session on %s",
    (pathname) => {
      expect(shouldRestrictToEmailVerification({
        user: { app_metadata: { provider: "email" } },
        pathname,
        isInviteRoute: false,
      })).toBe(true);
    },
  );

  it.each(["/verify-email", "/reset-password", "/invite/token"])(
    "preserves the verification-compatible route %s",
    (pathname) => {
      expect(shouldRestrictToEmailVerification({
        user: { app_metadata: { provider: "email" } },
        pathname,
        isInviteRoute: pathname.startsWith("/invite/"),
      })).toBe(false);
    },
  );

  it.each(["/privacy", "/terms", "/data-deletion"])(
    "keeps the public legal route %s available",
    (pathname) => {
      expect(shouldRestrictToEmailVerification({
        user: { app_metadata: { provider: "email" } },
        pathname,
        isInviteRoute: false,
      })).toBe(false);
    },
  );
});
