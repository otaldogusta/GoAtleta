import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearPendingInvite,
  clearPendingTrainerInvite,
  getPendingInvite,
  getPendingTrainerInvite,
  resolveAuthenticatedTrainerInviteEntry,
  resolvePendingInviteRedirect,
  resolvePendingTrainerCode,
  requiresTrainerInviteEmailVerification,
  savePendingInvite,
  savePendingTrainerInvite,
  shouldReturnTrainerInviteToSignup,
  shouldRedirectPendingRole,
} from "../pending-invite";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe("pending invite storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("keeps student and trainer invitations in separate keys", async () => {
    await savePendingInvite(" student-token ");
    await savePendingTrainerInvite(" abcd-1234 ");

    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      1,
      "pending_student_invite_v1",
      "student-token"
    );
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      2,
      "pending_trainer_invite_v1",
      "ABCD-1234"
    );
  });

  test("reads and clears both invitation types independently", async () => {
    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce("student-token")
      .mockResolvedValueOnce("TRAINER-CODE");

    await expect(getPendingInvite()).resolves.toBe("student-token");
    await expect(getPendingTrainerInvite()).resolves.toBe("TRAINER-CODE");

    await clearPendingInvite();
    await clearPendingTrainerInvite();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "pending_student_invite_v1"
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "pending_trainer_invite_v1"
    );
  });

  test.each([
    {
      pendingStudentToken: "student-token",
      pendingTrainerCode: "",
      expected: "/pending",
    },
    {
      pendingStudentToken: "",
      pendingTrainerCode: "TRAINER-CODE",
      expected: "/pending",
    },
    {
      pendingStudentToken: "",
      pendingTrainerCode: "",
      expected: "/prof/home",
    },
  ])(
    "routes pending invitations before the default post-login target",
    ({ pendingStudentToken, pendingTrainerCode, expected }) => {
      expect(
        resolvePendingInviteRedirect({
          pendingStudentToken,
          pendingTrainerCode,
          defaultTarget: "/prof/home",
        })
      ).toBe(expected);
    }
  );

  test("prioritizes the trainer invite in the login route over delayed storage", () => {
    expect(
      resolvePendingTrainerCode({
        routeCode: " route-code ",
        storedCode: "stale-code",
      })
    ).toBe("ROUTE-CODE");
  });

  test("falls back to the stored trainer invite when the route has none", () => {
    expect(
      resolvePendingTrainerCode({
        storedCode: " stored-code ",
      })
    ).toBe("STORED-CODE");
  });

  test("returns an unauthenticated stored trainer invite to signup", () => {
    expect(
      shouldReturnTrainerInviteToSignup({
        authLoading: false,
        hasSession: false,
        trainerCode: "TRAINER-CODE",
      })
    ).toBe(true);
  });

  test("waits for auth bootstrap before returning an invite to signup", () => {
    expect(
      shouldReturnTrainerInviteToSignup({
        authLoading: true,
        hasSession: false,
        trainerCode: "TRAINER-CODE",
      })
    ).toBe(false);
    expect(
      shouldReturnTrainerInviteToSignup({
        authLoading: false,
        hasSession: true,
        trainerCode: "TRAINER-CODE",
      })
    ).toBe(false);
  });

  test("preserves a trainer invite entering signup with an active session", () => {
    expect(
      resolveAuthenticatedTrainerInviteEntry({
        hasSession: true,
        pathname: "/signup",
        routeCode: " route-code ",
      })
    ).toBe("ROUTE-CODE");
  });

  test("does not intercept ordinary signup navigation", () => {
    expect(
      resolveAuthenticatedTrainerInviteEntry({
        hasSession: false,
        pathname: "/signup",
        routeCode: "route-code",
      })
    ).toBe("");
    expect(
      resolveAuthenticatedTrainerInviteEntry({
        hasSession: true,
        pathname: "/prof/home",
        routeCode: "route-code",
      })
    ).toBe("");
  });

  test("blocks trainer invite claim until hybrid email verification finishes", () => {
    expect(
      requiresTrainerInviteEmailVerification({
        email: "trainer@example.com",
        app_metadata: {
          provider: "email",
        },
        user_metadata: {
          requires_email_hybrid_verification: true,
        },
      })
    ).toBe(true);
    expect(
      requiresTrainerInviteEmailVerification({
        email: "trainer@example.com",
        app_metadata: {
          provider: "email",
          email_verified_hybrid_at: "2026-08-13T12:00:00.000Z",
        },
        user_metadata: {
          requires_email_hybrid_verification: true,
        },
      })
    ).toBe(false);
  });

  test("does not trust a verification timestamp written in user metadata", () => {
    expect(
      requiresTrainerInviteEmailVerification({
        email: "trainer@example.com",
        app_metadata: { provider: "email" },
        user_metadata: {
          requires_email_hybrid_verification: true,
          email_verified_hybrid_at: "spoofed-by-client",
        },
      })
    ).toBe(true);
  });

  test("accepts an external identity provider as the verified identity source", () => {
    expect(
      requiresTrainerInviteEmailVerification({
        email: "trainer@example.com",
        app_metadata: { provider: "google", providers: ["google"] },
        user_metadata: { requires_email_hybrid_verification: true },
      })
    ).toBe(false);
  });

  test("rejects anonymous and unknown identity providers", () => {
    expect(
      requiresTrainerInviteEmailVerification({
        email: "trainer@example.com",
        is_anonymous: true,
        app_metadata: { provider: "google" },
      })
    ).toBe(true);
    expect(
      requiresTrainerInviteEmailVerification({
        email: "trainer@example.com",
        app_metadata: { provider: "unknown-provider" },
      })
    ).toBe(true);
  });

  test.each(["/pending", "/verify-email"])(
    "keeps pending accounts on the %s flow",
    (pathname) => {
      expect(
        shouldRedirectPendingRole({
          hasSession: true,
          role: "pending",
          pathname,
          isInviteRoute: false,
        })
      ).toBe(false);
    }
  );

  test("redirects pending accounts away from protected application routes", () => {
    expect(
      shouldRedirectPendingRole({
        hasSession: true,
        role: "pending",
        pathname: "/prof/home",
        isInviteRoute: false,
      })
    ).toBe(true);
  });
});
