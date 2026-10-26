import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearPendingInvite,
  clearPendingInvites,
  clearPendingRelationshipInvite,
  clearPendingTrainerInvite,
  getPendingInvite,
  getPendingRelationshipInvite,
  getPendingTrainerInvite,
  resolveAuthenticatedTrainerInviteEntry,
  resolvePendingInviteRedirect,
  resolvePendingTrainerCode,
  resolvePostAuthEntryTarget,
  requiresTrainerInviteEmailVerification,
  savePendingInvite,
  savePendingRelationshipInvite,
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
    jest.resetAllMocks();
  });

  test("the latest explicit invitation replaces stale invitations from other entry flows", async () => {
    const values = new Map<string, string>();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key) => values.get(key) ?? null);
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => { values.set(key, value); });
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (key) => { values.delete(key); });
    await savePendingRelationshipInvite("expired-family-token");
    await savePendingTrainerInvite("ABCD-EFGH");
    expect(await getPendingRelationshipInvite()).toBe("");
    expect(await getPendingTrainerInvite()).toBe("ABCD-EFGH");
    // A later family or legacy athlete entry must also supersede the staff code.
    await savePendingRelationshipInvite("fresh-family-token");
    expect(await getPendingTrainerInvite()).toBe("");
    await savePendingInvite("fresh-student-token");
    expect(await getPendingRelationshipInvite()).toBe("");
    expect(await getPendingInvite()).toBe("fresh-student-token");
  });

  test("logout clears all entry intentions, including legacy keys left together by old versions", async () => {
    const values = new Map([
      ["pending_student_invite_v1", "old-student"],
      ["pending_student_relationship_invite_v1", "old-family"],
      ["pending_trainer_invite_v1", "old-staff"],
    ]);
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key) => values.get(key) ?? null);
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (key) => { values.delete(key); });
    await clearPendingInvites();
    expect(await getPendingInvite()).toBe("");
    expect(await getPendingRelationshipInvite()).toBe("");
    expect(await getPendingTrainerInvite()).toBe("");
  });

  test("serializes selections so the last selected type wins even without awaiting the first write", async () => {
    const values = new Map<string, string>();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key) => values.get(key) ?? null);
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => { values.set(key, value); });
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (key) => { values.delete(key); });
    await Promise.all([savePendingInvite("old-student"), savePendingTrainerInvite("ABCD-EFGH")]);
    expect(await getPendingInvite()).toBe("");
    expect(await getPendingTrainerInvite()).toBe("ABCD-EFGH");
  });

  test("keeps student, relationship and trainer invitations in separate keys", async () => {
    await savePendingInvite(" student-token ");
    await savePendingRelationshipInvite(" relationship-token ");
    await savePendingTrainerInvite(" abcd-1234 ");

    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      1,
      "pending_student_invite_v1",
      "student-token"
    );
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      2,
      "pending_student_relationship_invite_v1",
      "relationship-token"
    );
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
      3,
      "pending_trainer_invite_v1",
      "ABCD-1234"
    );
  });

  test("reads and clears all invitation types independently", async () => {
    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce("student-token")
      .mockResolvedValueOnce("relationship-token")
      .mockResolvedValueOnce("TRAINER-CODE");

    await expect(getPendingInvite()).resolves.toBe("student-token");
    await expect(getPendingRelationshipInvite()).resolves.toBe("relationship-token");
    await expect(getPendingTrainerInvite()).resolves.toBe("TRAINER-CODE");

    await clearPendingInvite();
    await clearPendingRelationshipInvite();
    await clearPendingTrainerInvite();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "pending_student_invite_v1"
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "pending_student_relationship_invite_v1"
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "pending_trainer_invite_v1"
    );
  });

  test.each([
    {
      pendingStudentToken: "student-token",
      pendingRelationshipToken: "",
      pendingTrainerCode: "",
      expected: "/pending",
    },
    {
      pendingStudentToken: "",
      pendingRelationshipToken: "",
      pendingTrainerCode: "TRAINER-CODE",
      expected: "/pending",
    },
    {
      pendingStudentToken: "",
      pendingRelationshipToken: " relationship/token ",
      pendingTrainerCode: "TRAINER-CODE",
      expected: "/family-invite/relationship%2Ftoken",
    },
    {
      pendingStudentToken: "",
      pendingRelationshipToken: "",
      pendingTrainerCode: "",
      expected: "/prof/home",
    },
  ])(
    "routes pending invitations before the default post-login target",
    ({ pendingStudentToken, pendingRelationshipToken, pendingTrainerCode, expected }) => {
      expect(
        resolvePendingInviteRedirect({
          pendingStudentToken,
          pendingRelationshipToken,
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

  test.each(["/student/home", "/student-plan", "/student/profile", "/student/profile/settings"])(
    "allows a pending athlete to use the free %s experience",
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

  test("returns pending accounts from protected application routes to their free home", () => {
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

describe("post-auth entry continuity", () => {
  const user = { email: "person@example.test", app_metadata: { email_verified_hybrid_at: "verified" } };
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("");
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });
  it("persists the route invite before sending an unverified account to OTP", async () => {
    expect(await resolvePostAuthEntryTarget({ user: { email: user.email }, routeTrainerCode: "abcd-efgh", defaultTarget: "/student/home" }))
      .toBe("/verify-email?email=person%40example.test");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("pending_trainer_invite_v1", "ABCD-EFGH");
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });
  it.each([
    ["pending_trainer_invite_v1", "ABCD-EFGH", "/pending"],
    ["pending_student_invite_v1", "student-token", "/pending"],
    ["pending_student_relationship_invite_v1", "family-token", "/family-invite/family-token"],
  ])("resumes %s instead of the default portal", async (key, value, target) => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (name) => name === key ? value : "");
    expect(await resolvePostAuthEntryTarget({ user, defaultTarget: "/student/home", next: "/coord/dashboard" })).toBe(target);
  });
  it("preserves the free home without an invitation or a granted institutional role", async () => {
    expect(await resolvePostAuthEntryTarget({ user, defaultTarget: "/student/home", next: "https://untrusted.test" })).toBe("/student/home");
  });
  it("honors a safe return target only after invitations have been resolved", async () => {
    expect(await resolvePostAuthEntryTarget({ user, defaultTarget: "/student/home", next: "/student/profile" })).toBe("/student/profile");
  });
});
