import { act, renderHook } from "@testing-library/react-native";

import { isPlatformAdmin } from "../../api/organization-access-requests";
import { supabaseRestRequest } from "../../api/rest";
import { usePlatformAdminAccessState } from "../use-platform-admin-access";
import { SessionIdentityChangedError } from "../session";

let mockIdentity = { userId: "user-a", generation: 1 };
let mockAuthUserId: string | null = "user-a";
let mockAuthLoading = false;

jest.mock("../auth", () => ({
  useAuth: () => ({ session: mockAuthUserId ? { user: { id: mockAuthUserId } } : null, loading: mockAuthLoading }),
}));
jest.mock("../session", () => {
  class IdentityChangedError extends Error {}
  return {
    getSessionIdentity: () => ({ ...mockIdentity }),
    isSessionIdentityCurrent: (identity: typeof mockIdentity) =>
      identity.userId === mockIdentity.userId && identity.generation === mockIdentity.generation,
    assertSessionIdentity: (identity: typeof mockIdentity) => {
      if (identity.userId !== mockIdentity.userId || identity.generation !== mockIdentity.generation) {
        throw new IdentityChangedError("session changed");
      }
    },
    SessionIdentityChangedError: IdentityChangedError,
  };
});
jest.mock("../../api/rest", () => ({ supabaseRestRequest: jest.fn(), supabaseRestPost: jest.fn() }));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIdentity = { userId: "user-a", generation: 1 };
  mockAuthUserId = "user-a";
  mockAuthLoading = false;
  jest.mocked(supabaseRestRequest).mockResolvedValue(false);
});

test("waits for persisted auth restoration before querying the platform RPC", async () => {
  mockAuthLoading = true;
  mockAuthUserId = null;
  const pending = deferred<boolean>();
  jest.mocked(supabaseRestRequest).mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(usePlatformAdminAccessState);
  expect(result.current).toEqual({ allowed: false, loading: true });
  expect(supabaseRestRequest).not.toHaveBeenCalled();

  // Auth may expose the persisted user before its validation has finished.
  mockAuthUserId = "user-a";
  rerender({});
  expect(result.current).toEqual({ allowed: false, loading: true });
  expect(supabaseRestRequest).not.toHaveBeenCalled();

  mockAuthLoading = false;
  rerender({});
  expect(result.current).toEqual({ allowed: false, loading: true });
  expect(supabaseRestRequest).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(true); });
  expect(result.current).toEqual({ allowed: true, loading: false });
});

test("does not carry a pending cold-start grant into another account", async () => {
  const first = deferred<boolean>();
  const second = deferred<boolean>();
  jest.mocked(supabaseRestRequest).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result, rerender } = renderHook(usePlatformAdminAccessState);
  mockAuthUserId = "user-b";
  mockIdentity = { userId: "user-b", generation: 2 };
  rerender({});
  await act(async () => { first.resolve(true); });
  expect(result.current).toEqual({ allowed: false, loading: true });
  await act(async () => { second.resolve(false); });
  expect(result.current).toEqual({ allowed: false, loading: false });
});

test("shares only pending platform checks and asks again after success", async () => {
  const first = deferred<boolean>();
  jest.mocked(supabaseRestRequest).mockReturnValueOnce(first.promise);
  const checks = Array.from({ length: 4 }, () => isPlatformAdmin());
  expect(supabaseRestRequest).toHaveBeenCalledTimes(1);
  expect(supabaseRestRequest).toHaveBeenCalledWith("/rpc/is_platform_admin", expect.objectContaining({
    method: "POST", body: {}, prefer: "return=representation", assertContextCurrent: expect.any(Function),
  }));
  first.resolve(true);
  await expect(Promise.all(checks)).resolves.toEqual([true, true, true, true]);
  await expect(isPlatformAdmin()).resolves.toBe(false);
  expect(supabaseRestRequest).toHaveBeenCalledTimes(2);
});

test("shares a failure without retaining it for the next attempt", async () => {
  const first = deferred<boolean>();
  jest.mocked(supabaseRestRequest).mockReturnValueOnce(first.promise);
  const firstCheck = isPlatformAdmin();
  const secondCheck = isPlatformAdmin();
  const error = new Error("network unavailable");
  const rejected = [expect(firstCheck).rejects.toBe(error), expect(secondCheck).rejects.toBe(error)];
  first.reject(error);
  await Promise.all(rejected);
  await expect(isPlatformAdmin()).resolves.toBe(false);
  expect(supabaseRestRequest).toHaveBeenCalledTimes(2);
});

test.each(["another account", "logout and login to the same account"])("isolates %s and does not let old cleanup evict a new request", async kind => {
  const first = deferred<boolean>();
  const second = deferred<boolean>();
  jest.mocked(supabaseRestRequest).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const firstCheck = isPlatformAdmin();
  mockIdentity = { userId: kind === "another account" ? "user-b" : "user-a", generation: 3 };
  const secondCheck = isPlatformAdmin();
  const oldRejected = expect(firstCheck).rejects.toBeInstanceOf(SessionIdentityChangedError);
  first.resolve(true);
  await oldRejected;
  const thirdCheck = isPlatformAdmin();
  expect(supabaseRestRequest).toHaveBeenCalledTimes(2);
  second.resolve(false);
  await expect(Promise.all([secondCheck, thirdCheck])).resolves.toEqual([false, false]);
});

test("returns denied without making a request when signed out", async () => {
  mockIdentity = { userId: "", generation: 2 };
  await expect(isPlatformAdmin()).resolves.toBe(false);
  expect(supabaseRestRequest).not.toHaveBeenCalled();
});

test("fails closed for a malformed non-boolean RPC result", async () => {
  jest.mocked(supabaseRestRequest).mockResolvedValueOnce([]);
  await expect(isPlatformAdmin()).resolves.toBe(false);
});

test("provides a session guard to the transport that rejects retries under another account", async () => {
  const pending = deferred<boolean>();
  jest.mocked(supabaseRestRequest).mockReturnValueOnce(pending.promise);
  const check = isPlatformAdmin();
  const guard = jest.mocked(supabaseRestRequest).mock.calls[0][1]?.assertContextCurrent;
  expect(guard).toBeDefined();
  mockIdentity = { userId: "user-b", generation: 2 };
  expect(guard).toThrow(SessionIdentityChangedError);
  const rejected = expect(check).rejects.toBeInstanceOf(SessionIdentityChangedError);
  pending.resolve(true);
  await rejected;
});

test("layout and sidebar consumers share work without granting access while loading", async () => {
  const pending = deferred<boolean>();
  jest.mocked(supabaseRestRequest).mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => [usePlatformAdminAccessState(), usePlatformAdminAccessState()]);
  expect(result.current).toEqual([{ allowed: false, loading: true }, { allowed: false, loading: true }]);
  expect(supabaseRestRequest).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(true); });
  expect(result.current).toEqual([{ allowed: true, loading: false }, { allowed: true, loading: false }]);
});

test("unmounting one consumer leaves the shared request usable by the other", async () => {
  const pending = deferred<boolean>();
  jest.mocked(supabaseRestRequest).mockReturnValueOnce(pending.promise);
  const first = renderHook(usePlatformAdminAccessState);
  const second = renderHook(usePlatformAdminAccessState);
  first.unmount();
  await act(async () => { pending.resolve(true); });
  expect(second.result.current).toEqual({ allowed: true, loading: false });
  expect(supabaseRestRequest).toHaveBeenCalledTimes(1);
});

test("discards old allowed responses after a same-account session rotation", async () => {
  const first = deferred<boolean>();
  const second = deferred<boolean>();
  jest.mocked(supabaseRestRequest).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result, rerender } = renderHook(usePlatformAdminAccessState);
  mockIdentity = { userId: "user-a", generation: 3 };
  rerender({});
  expect(result.current).toEqual({ allowed: false, loading: true });
  await act(async () => { first.resolve(true); });
  expect(result.current).toEqual({ allowed: false, loading: true });
  await act(async () => { second.resolve(false); });
  expect(result.current).toEqual({ allowed: false, loading: false });
});

test("invalidates a settled grant immediately when the same account logs in again", async () => {
  jest.mocked(supabaseRestRequest).mockResolvedValueOnce(true);
  const { result, rerender } = renderHook(usePlatformAdminAccessState);
  await act(async () => undefined);
  expect(result.current.allowed).toBe(true);
  const pending = deferred<boolean>();
  jest.mocked(supabaseRestRequest).mockReturnValueOnce(pending.promise);
  mockIdentity = { userId: "user-a", generation: 3 };
  rerender({});
  expect(result.current).toEqual({ allowed: false, loading: true });
  await act(async () => { pending.resolve(false); });
  expect(result.current).toEqual({ allowed: false, loading: false });
});
