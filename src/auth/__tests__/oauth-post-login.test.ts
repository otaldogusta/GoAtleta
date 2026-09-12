import { isRecentlyCreatedAuthUser, resolveOAuthEntryTarget } from "../oauth-post-login";
import type { AuthSession } from "../session";

const buildSession = (createdAt: string): AuthSession => ({
  access_token: "access",
  refresh_token: "refresh",
  expires_at: 9999999999,
  user: { id: "user-1", email: "atleta@example.com", created_at: createdAt },
});

describe("OAuth post-login entry", () => {
  const nowMs = Date.parse("2026-09-12T12:00:00.000Z");

  it("sends a newly created account to the student home instead of a stale deep link", () => {
    const session = buildSession("2026-09-12T11:58:00.000Z");
    expect(
      resolveOAuthEntryTarget({
        session,
        pendingDestination: "/student/profile",
        hasPendingInvite: false,
        nowMs,
      }),
    ).toBe("/student/home");
  });

  it("preserves invitations and returning-user destinations", () => {
    const newSession = buildSession("2026-09-12T11:58:00.000Z");
    const returningSession = buildSession("2026-09-01T12:00:00.000Z");
    expect(
      resolveOAuthEntryTarget({
        session: newSession,
        pendingDestination: "/invite/token",
        hasPendingInvite: true,
        nowMs,
      }),
    ).toBe("/invite/token");
    expect(
      resolveOAuthEntryTarget({
        session: returningSession,
        pendingDestination: "/student/profile",
        hasPendingInvite: false,
        nowMs,
      }),
    ).toBe("/student/profile");
  });

  it("does not classify malformed creation dates as new accounts", () => {
    expect(isRecentlyCreatedAuthUser(buildSession("").user, nowMs)).toBe(false);
  });
});
