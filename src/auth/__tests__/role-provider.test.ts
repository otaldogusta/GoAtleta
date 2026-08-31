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

let latestRoleState: RoleSnapshot;

function RoleProbe() {
  latestRoleState = useRole();
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
  });

  afterEach(() => {
    if (renderer) {
      act(() => renderer?.unmount());
      renderer = undefined;
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
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
});
