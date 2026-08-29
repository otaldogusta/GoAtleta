import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockUseAuth = jest.fn();
const mockGetDevProfilePreview = jest.fn();
const mockGetActiveRolePreference = jest.fn();
const mockSetActiveRolePreference = jest.fn();
const mockGetAccessToken = jest.fn();
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

jest.mock("../auth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../../dev/profile-preview", () => ({
  getDevProfilePreview: () => mockGetDevProfilePreview(),
}));

jest.mock("../active-role", () => ({
  getActiveRolePreference: (userId: string) => mockGetActiveRolePreference(userId),
  setActiveRolePreference: (userId: string, role: string) =>
    mockSetActiveRolePreference(userId, role),
}));

jest.mock("../session", () => ({
  getAccessToken: () => mockGetAccessToken(),
  getSessionUserId: () => mockGetSessionUserId(),
  getValidAccessToken: () => mockGetValidAccessToken(),
}));

type RoleSnapshot = {
  role: string | null;
  availableRoles: string[];
  student: unknown | null;
  loading: boolean;
};

const { ROLE_REQUEST_TIMEOUT_MS, RoleProvider, useRole } = require("../role") as {
  ROLE_REQUEST_TIMEOUT_MS: number;
  RoleProvider: React.ComponentType<{ children: React.ReactNode }>;
  useRole: () => RoleSnapshot;
};

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

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
    mockGetAccessToken.mockReturnValue("cached-access-token");
    mockGetActiveRolePreference.mockResolvedValue(null);
    mockSetActiveRolePreference.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (renderer) {
      act(() => renderer?.unmount());
      renderer = undefined;
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("bounds both role requests and restores a cached student role without fabricated data", async () => {
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
    expect(latestRoleState.role).toBe("student");
    expect(latestRoleState.availableRoles).toEqual(["student"]);
    expect(latestRoleState.student).toBeNull();
    expect(mockGetActiveRolePreference).toHaveBeenCalledWith("user-1");
    for (const [, init] of fetchSpy.mock.calls) {
      expect(init?.signal?.aborted).toBe(true);
    }
  });

  it("keeps authorization failures pending instead of trusting the cached role", async () => {
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
    expect(latestRoleState.role).toBe("pending");
    expect(latestRoleState.availableRoles).toEqual([]);
    expect(latestRoleState.student).toBeNull();
    expect(mockGetActiveRolePreference).toHaveBeenCalledWith("user-1");
  });
});
