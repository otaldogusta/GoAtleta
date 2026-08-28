import { hasTrustedInviteIdentity } from "../invite-email-verification";

describe("trusted invite identity", () => {
  test("accepts the server-managed hybrid OTP proof", () => {
    expect(
      hasTrustedInviteIdentity({
        email: "atleta@example.com",
        app_metadata: {
          provider: "email",
          email_verified_hybrid_at: "2026-08-25T12:00:00.000Z",
        },
      })
    ).toBe(true);
  });

  test("accepts only the configured external identity providers", () => {
    expect(
      hasTrustedInviteIdentity({
        email: "atleta@example.com",
        app_metadata: { provider: "google" },
      })
    ).toBe(true);
    expect(
      hasTrustedInviteIdentity({
        email: "atleta@example.com",
        app_metadata: { provider: "unknown-provider" },
      })
    ).toBe(false);
  });

  test("rejects anonymous or e-mail-less identities", () => {
    expect(
      hasTrustedInviteIdentity({
        email: "atleta@example.com",
        is_anonymous: true,
        app_metadata: { provider: "google" },
      })
    ).toBe(false);
    expect(
      hasTrustedInviteIdentity({ app_metadata: { provider: "google" } })
    ).toBe(false);
  });
});
