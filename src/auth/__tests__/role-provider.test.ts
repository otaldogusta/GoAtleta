import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockUseAuth = jest.fn();
const mockGetDevProfilePreview = jest.fn();
const mockGetActiveRolePreference = jest.fn();
const mockSetActiveRolePreference = jest.fn();
const mockGetActiveFamilyStudentPreference = jest.fn();
const mockSetActiveFamilyStudentPreference = jest.fn();
const mockGetMyStudentContexts = jest.fn();
const mockIsFamilyFoundationUnavailable = jest.fn();
const mockGetSessionUserId = jest.fn();
const mockGetValidAccessToken = jest.fn();
const mockCaptureException = jest.fn();
const mockReconcileMyStudentAccess = jest.fn();

jest.mock("../student-access-reconciliation", () => ({
  reconcileMyStudentAccess: (...args: unknown[]) => mockReconcileMyStudentAccess(...args),
}));

jest.mock("@sentry/react-native", () => ({
  captureException: mockCaptureException,
}));

jest.mock("../../api/config", () => ({
  SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_URL: "https://example.supabase.co",
}));

jest.mock("../../api/family-access", () => ({
  getMyStudentContexts: (...args: unknown[]) =>
    mockGetMyStudentContexts(...args),
  isFamilyFoundationUnavailable: (...args: unknown[]) =>
    mockIsFamilyFoundationUnavailable(...args),
}));

jest.mock("../auth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../../dev/profile-preview", () => ({
  getDevProfilePreview: () => mockGetDevProfilePreview(),
}));

jest.mock("../active-role", () => ({
  getActiveRolePreference: (userId: string) =>
    mockGetActiveRolePreference(userId),
  setActiveRolePreference: (userId: string, role: string) =>
    mockSetActiveRolePreference(userId, role),
  getActiveFamilyStudentPreference: (userId: string) =>
    mockGetActiveFamilyStudentPreference(userId),
  setActiveFamilyStudentPreference: (userId: string, studentId: string) =>
    mockSetActiveFamilyStudentPreference(userId, studentId),
}));

jest.mock("../session", () => ({
  getSessionUserId: () => mockGetSessionUserId(),
  getValidAccessToken: () => mockGetValidAccessToken(),
}));

type RoleSnapshot = {
  role: string | null;
  availableRoles: string[];
  student: unknown | null;
  studentAccessResolution: string | null;
  familyContexts: { studentId: string }[];
  selectedFamilyStudent: { studentId: string } | null;
  loading: boolean;
  error: Error | null;
  retry: () => Promise<void>;
};

const { ROLE_REQUEST_TIMEOUT_MS, RoleProvider, useRole } =
  require("../role") as {
    ROLE_REQUEST_TIMEOUT_MS: number;
    RoleProvider: React.ComponentType<{ children: React.ReactNode }>;
    useRole: () => RoleSnapshot;
  };

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const session = {
  access_token: "cached-access-token",
  refresh_token: "cached-refresh-token",
  expires_at: 2_000_000_000,
  user: { id: "user-1", email: "student@example.com" },
};

const secondSession = {
  ...session,
  access_token: "second-access-token",
  refresh_token: "second-refresh-token",
  user: { id: "user-2", email: "family@example.com" },
};

const buildFamilyContext = (studentId: string) => ({
  relationshipId: `relationship-${studentId}`,
  relationshipType: "guardian",
  relationshipLabel: "Responsável",
  studentId,
  studentName: `Student ${studentId}`,
  studentPhotoUrl: null,
  organizationId: `organization-${studentId}`,
  organizationName: `Organization ${studentId}`,
  classId: null,
  className: null,
  isFinancialResponsible: false,
  canViewAgenda: true,
  canViewAttendance: true,
  canViewProgress: false,
  canViewFinance: false,
  canPay: false,
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

let latestRoleState: RoleSnapshot;
let roleStateSnapshots: RoleSnapshot[] = [];

function RoleProbe() {
  const roleState = useRole();
  React.useLayoutEffect(() => {
    latestRoleState = roleState;
    roleStateSnapshots.push(roleState);
  }, [roleState]);
  return React.createElement("RoleProbe");
}

const flushMicrotasks = async () => {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
};

describe("RoleProvider bootstrap resilience", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    roleStateSnapshots = [];
    mockUseAuth.mockReturnValue({ session });
    mockGetDevProfilePreview.mockResolvedValue("auto");
    mockGetValidAccessToken.mockResolvedValue("valid-access-token");
    mockGetSessionUserId.mockResolvedValue("user-1");
    mockGetActiveRolePreference.mockResolvedValue(null);
    mockSetActiveRolePreference.mockResolvedValue(undefined);
    mockGetActiveFamilyStudentPreference.mockResolvedValue(null);
    mockSetActiveFamilyStudentPreference.mockResolvedValue(undefined);
    mockGetMyStudentContexts.mockResolvedValue([]);
    mockIsFamilyFoundationUnavailable.mockReturnValue(false);
    mockReconcileMyStudentAccess.mockReset().mockResolvedValue("not_found");
  });

  afterEach(() => {
    if (renderer) {
      act(() => renderer?.unmount());
      renderer = undefined;
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each(["admin", "student"])("ignores a saved %s preview for an ordinary professor", async (preview) => {
    mockGetDevProfilePreview.mockResolvedValue(preview);
    jest.spyOn(global, "fetch").mockImplementation(async (input) => ({
      ok: true, status: 200,
      text: async () => String(input).includes("/rpc/is_trainer") ? "true" : "[]",
    }) as Response);
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(RoleProvider, null, React.createElement(RoleProbe)));
      await flushMicrotasks();
    });
    expect(latestRoleState).toMatchObject({ role: "trainer", availableRoles: ["trainer"], student: null });
    expect(mockGetDevProfilePreview).not.toHaveBeenCalled();
  });

  it("waits for reconciliation and reloads RLS before publishing the student role", async () => {
    const reconciliation = createDeferred<string>();
    mockReconcileMyStudentAccess.mockReturnValue(reconciliation.promise);
    let studentReads = 0;
    jest.spyOn(global, "fetch").mockImplementation(async (input) => ({
      ok: true, status: 200,
      text: async () => String(input).includes("/rpc/is_trainer") ? "false"
        : JSON.stringify(++studentReads > 1 ? [{ id: "existing-student", name: "Existing", organization_id: "org-1" }] : []),
    }) as Response);
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(RoleProvider, null, React.createElement(RoleProbe)));
      await flushMicrotasks();
    });
    expect(latestRoleState.loading).toBe(true);
    expect(latestRoleState.role).toBeNull();
    expect(mockReconcileMyStudentAccess).toHaveBeenCalledWith("valid-access-token");
    await act(async () => { reconciliation.resolve("linked"); await flushMicrotasks(); });
    expect(latestRoleState.role).toBe("student");
    expect(latestRoleState.student).toMatchObject({ id: "existing-student" });
    expect(roleStateSnapshots.some(snapshot => snapshot.role === "pending")).toBe(false);
    expect(studentReads).toBe(2);
  });

  it.each(["verification_required", "review_required", "invite_required", "unavailable", "not_found"])(
    "keeps %s pending without granting access", async (status) => {
      mockReconcileMyStudentAccess.mockResolvedValue(status);
      jest.spyOn(global, "fetch").mockImplementation(async (input) => ({
        ok: true, status: 200, text: async () => String(input).includes("/rpc/is_trainer") ? "false" : "[]",
      }) as Response);
      await act(async () => {
        renderer = TestRenderer.create(React.createElement(RoleProvider, null, React.createElement(RoleProbe)));
        await flushMicrotasks();
      });
      expect(latestRoleState).toMatchObject({ role: "pending", student: null, studentAccessResolution: status });
    },
  );

  it("never trusts a claim receipt when RLS still returns no student", async () => {
    mockReconcileMyStudentAccess.mockResolvedValue("linked");
    jest.spyOn(global, "fetch").mockImplementation(async (input) => ({
      ok: true, status: 200, text: async () => String(input).includes("/rpc/is_trainer") ? "false" : "[]",
    }) as Response);
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(RoleProvider, null, React.createElement(RoleProbe)));
      await flushMicrotasks();
    });
    expect(latestRoleState).toMatchObject({ role: "pending", student: null, studentAccessResolution: "unavailable" });
  });

  it("discards a reconciliation response after logout", async () => {
    const reconciliation = createDeferred<string>();
    mockReconcileMyStudentAccess.mockReturnValue(reconciliation.promise);
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async (input) => ({
      ok: true, status: 200, text: async () => String(input).includes("/rpc/is_trainer") ? "false" : "[]",
    }) as Response);
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(RoleProvider, null, React.createElement(RoleProbe)));
      await flushMicrotasks();
    });
    mockUseAuth.mockReturnValue({ session: null });
    await act(async () => {
      renderer?.update(React.createElement(RoleProvider, null, React.createElement(RoleProbe)));
      await flushMicrotasks();
    });
    await act(async () => {
      reconciliation.resolve("linked");
      await flushMicrotasks();
    });
    expect(latestRoleState).toMatchObject({ role: null, student: null, studentAccessResolution: null });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not reconcile existing guardian access", async () => {
    mockGetMyStudentContexts.mockResolvedValue([buildFamilyContext("child")]);
    jest.spyOn(global, "fetch").mockImplementation(async (input) => ({
      ok: true, status: 200, text: async () => String(input).includes("/rpc/is_trainer") ? "false" : "[]",
    }) as Response);
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(RoleProvider, null, React.createElement(RoleProbe)));
      await flushMicrotasks();
    });
    expect(latestRoleState.role).toBe("family");
    expect(mockReconcileMyStudentAccess).not.toHaveBeenCalled();
  });

  it("bounds both role requests and never grants the cached role after a timeout", async () => {
    jest.useFakeTimers();
    mockGetActiveRolePreference.mockResolvedValue("student");
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }) as Promise<Response>,
    );

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(RoleProvider, null, React.createElement(RoleProbe)),
      );
      await flushMicrotasks();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(latestRoleState.loading).toBe(true);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(ROLE_REQUEST_TIMEOUT_MS);
      await flushMicrotasks();
    });

    expect(latestRoleState.loading).toBe(false);
    expect(latestRoleState.role).toBeNull();
    expect(latestRoleState.availableRoles).toEqual([]);
    expect(latestRoleState.student).toBeNull();
    expect(latestRoleState.error?.message).toBe(
      "Tempo esgotado ao carregar o perfil.",
    );
    for (const [, init] of fetchSpy.mock.calls) {
      expect(init?.signal?.aborted).toBe(true);
    }
  });

  it("propagates authorization failures instead of trusting the cached role", async () => {
    mockGetActiveRolePreference.mockResolvedValue("trainer");
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: "unauthorized" }),
    } as Response);

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(RoleProvider, null, React.createElement(RoleProbe)),
      );
      await flushMicrotasks();
    });

    expect(latestRoleState.loading).toBe(false);
    expect(latestRoleState.role).toBeNull();
    expect(latestRoleState.availableRoles).toEqual([]);
    expect(latestRoleState.student).toBeNull();
    expect(latestRoleState.error).toBeInstanceOf(Error);
    expect(mockGetActiveRolePreference).toHaveBeenCalledWith("user-1");
  });

  it("never grants a cached family role when the live relationship request fails", async () => {
    mockGetActiveRolePreference.mockResolvedValue("family");
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(RoleProvider, null, React.createElement(RoleProbe)),
      );
      await flushMicrotasks();
    });

    expect(latestRoleState.loading).toBe(false);
    expect(latestRoleState.role).toBeNull();
    expect(latestRoleState.availableRoles).toEqual([]);
    expect(latestRoleState.error?.message).toBe("offline");
  });

  it("exposes a retry that revalidates live authorization after a transient error", async () => {
    mockGetActiveRolePreference.mockResolvedValue("trainer");
    mockGetMyStudentContexts
      .mockRejectedValueOnce(new Error("temporary network failure"))
      .mockResolvedValue([]);
    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      return {
        ok: true,
        status: 200,
        text: async () => (url.includes("/rpc/is_trainer") ? "true" : "[]"),
      } as Response;
    });

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(RoleProvider, null, React.createElement(RoleProbe)),
      );
      await flushMicrotasks();
    });

    expect(latestRoleState.role).toBeNull();
    expect(latestRoleState.error?.message).toBe("temporary network failure");

    await act(async () => {
      await latestRoleState.retry();
      await flushMicrotasks();
    });

    expect(latestRoleState.error).toBeNull();
    expect(latestRoleState.role).toBe("trainer");
    expect(latestRoleState.availableRoles).toEqual(["trainer"]);
  });

  it("propagates server failures without granting a cached role", async () => {
    mockGetActiveRolePreference.mockResolvedValue("trainer");
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ message: "service unavailable" }),
    } as Response);

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(RoleProvider, null, React.createElement(RoleProbe)),
      );
      await flushMicrotasks();
    });

    expect(latestRoleState.loading).toBe(false);
    expect(latestRoleState.role).toBeNull();
    expect(latestRoleState.availableRoles).toEqual([]);
    expect(latestRoleState.error).toBeInstanceOf(Error);
  });

  it("treats a missing family foundation as no family role without reporting an incident", async () => {
    const foundationError = new Error("PGRST202");
    mockGetMyStudentContexts.mockRejectedValue(foundationError);
    mockIsFamilyFoundationUnavailable.mockReturnValue(true);
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "true",
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "[]",
      } as Response);

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(RoleProvider, null, React.createElement(RoleProbe)),
      );
      await flushMicrotasks();
    });

    expect(latestRoleState.role).toBe("trainer");
    expect(latestRoleState.availableRoles).toEqual(["trainer"]);
    expect(latestRoleState.error).toBeNull();
    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockIsFamilyFoundationUnavailable).toHaveBeenCalledWith(
      foundationError,
    );
  });

  it("ignores an older refresh after another user session becomes current", async () => {
    const staleFirstFamilyContexts = createDeferred<
      ReturnType<typeof buildFamilyContext>[]
    >();
    const firstContext = buildFamilyContext("student-first");
    const secondContext = buildFamilyContext("student-second");
    let firstSessionContextRequestCount = 0;

    mockGetValidAccessToken
      .mockReset()
      .mockResolvedValueOnce("token-first")
      .mockResolvedValueOnce("token-first")
      .mockResolvedValueOnce("token-second");
    mockGetSessionUserId
      .mockReset()
      .mockResolvedValueOnce("user-1")
      .mockResolvedValueOnce("user-1")
      .mockResolvedValueOnce("user-2");
    mockGetMyStudentContexts.mockImplementation((token: string) => {
      if (token === "token-second") return Promise.resolve([secondContext]);

      firstSessionContextRequestCount += 1;
      return firstSessionContextRequestCount === 1
        ? Promise.resolve([firstContext])
        : staleFirstFamilyContexts.promise;
    });
    mockGetActiveRolePreference.mockResolvedValue("family");
    mockGetActiveFamilyStudentPreference.mockImplementation((userId: string) =>
      Promise.resolve(userId === "user-2" ? secondContext.studentId : null),
    );
    jest.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      const isFirstSession = headers?.Authorization === "Bearer token-first";
      const responseText = String(input).includes("/rpc/is_trainer")
        ? isFirstSession
          ? "true"
          : "false"
        : "[]";
      return {
        ok: true,
        status: 200,
        text: async () => responseText,
      } as Response;
    });

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(RoleProvider, null, React.createElement(RoleProbe)),
      );
      await flushMicrotasks();
    });

    expect(latestRoleState.role).toBe("family");
    expect(latestRoleState.familyContexts).toEqual([firstContext]);
    expect(latestRoleState.selectedFamilyStudent).toEqual(firstContext);
    expect(latestRoleState.loading).toBe(false);

    await act(async () => {
      void latestRoleState.retry();
      await flushMicrotasks();
    });

    expect(mockGetMyStudentContexts).toHaveBeenCalledTimes(2);
    expect(latestRoleState.loading).toBe(true);
    const switchSnapshotStart = roleStateSnapshots.length;

    mockUseAuth.mockReturnValue({ session: secondSession });
    await act(async () => {
      renderer?.update(
        React.createElement(RoleProvider, null, React.createElement(RoleProbe)),
      );
      await flushMicrotasks();
    });

    expect(roleStateSnapshots[switchSnapshotStart]).toMatchObject({
      role: null,
      availableRoles: [],
      student: null,
      familyContexts: [],
      selectedFamilyStudent: null,
      loading: true,
      error: null,
    });
    expect(latestRoleState.loading).toBe(false);
    expect(latestRoleState.role).toBe("family");
    expect(latestRoleState.familyContexts).toEqual([secondContext]);
    expect(latestRoleState.selectedFamilyStudent).toEqual(secondContext);

    await act(async () => {
      staleFirstFamilyContexts.resolve([firstContext]);
      await flushMicrotasks();
    });

    expect(latestRoleState.loading).toBe(false);
    expect(latestRoleState.role).toBe("family");
    expect(latestRoleState.familyContexts).toEqual([secondContext]);
    expect(latestRoleState.selectedFamilyStudent).toEqual(secondContext);
    expect(latestRoleState.error).toBeNull();
  });

  it("keeps signed-out state after an older session refresh resolves", async () => {
    const staleFirstFamilyContexts = createDeferred<
      ReturnType<typeof buildFamilyContext>[]
    >();
    const firstContext = buildFamilyContext("student-first");

    mockGetActiveRolePreference.mockResolvedValue("family");
    mockGetActiveFamilyStudentPreference.mockResolvedValue(
      firstContext.studentId,
    );
    mockGetMyStudentContexts
      .mockReset()
      .mockResolvedValueOnce([firstContext])
      .mockReturnValueOnce(staleFirstFamilyContexts.promise);
    jest.spyOn(global, "fetch").mockImplementation(async (input) => ({
      ok: true,
      status: 200,
      text: async () =>
        String(input).includes("/rpc/is_trainer") ? "true" : "[]",
    }) as Response);

    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(RoleProvider, null, React.createElement(RoleProbe)),
      );
      await flushMicrotasks();
    });

    expect(latestRoleState.role).toBe("family");
    expect(latestRoleState.familyContexts).toEqual([firstContext]);
    expect(latestRoleState.selectedFamilyStudent).toEqual(firstContext);
    expect(latestRoleState.loading).toBe(false);

    await act(async () => {
      void latestRoleState.retry();
      await flushMicrotasks();
    });

    expect(latestRoleState.loading).toBe(true);
    const logoutSnapshotStart = roleStateSnapshots.length;

    mockUseAuth.mockReturnValue({ session: null });
    await act(async () => {
      renderer?.update(
        React.createElement(RoleProvider, null, React.createElement(RoleProbe)),
      );
      await flushMicrotasks();
    });

    expect(roleStateSnapshots[logoutSnapshotStart]).toMatchObject({
      role: null,
      availableRoles: [],
      student: null,
      familyContexts: [],
      selectedFamilyStudent: null,
      loading: false,
      error: null,
    });
    expect(latestRoleState.loading).toBe(false);
    expect(latestRoleState.role).toBeNull();
    expect(latestRoleState.availableRoles).toEqual([]);
    expect(latestRoleState.familyContexts).toEqual([]);
    expect(latestRoleState.selectedFamilyStudent).toBeNull();

    await act(async () => {
      staleFirstFamilyContexts.resolve([firstContext]);
      await flushMicrotasks();
    });

    expect(latestRoleState.loading).toBe(false);
    expect(latestRoleState.role).toBeNull();
    expect(latestRoleState.availableRoles).toEqual([]);
    expect(latestRoleState.familyContexts).toEqual([]);
    expect(latestRoleState.selectedFamilyStudent).toBeNull();
    expect(latestRoleState.error).toBeNull();
  });
});
