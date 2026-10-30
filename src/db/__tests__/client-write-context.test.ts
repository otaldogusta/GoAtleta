let mockIdentity = { userId: "user-a", generation: 1 };
const mockToken = jest.fn(), mockRefresh = jest.fn();
jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(async () => "org-a") }));
jest.mock("@sentry/react-native", () => ({ addBreadcrumb() {}, setContext() {} }));
jest.mock("../../api/config", () => ({ SUPABASE_URL: "https://fixture.test", SUPABASE_ANON_KEY: "fixture" }));
jest.mock("../read-cache-storage", () => ({ clearReadCacheStorage: jest.fn(), getReadCacheItem: jest.fn(), removeReadCacheItem: jest.fn(), setReadCacheItem: jest.fn() }));
jest.mock("../../auth/session", () => ({ getSessionIdentity: () => ({ ...mockIdentity }), assertSessionIdentity: (value: typeof mockIdentity) => { if (value.userId !== mockIdentity.userId || value.generation !== mockIdentity.generation) throw new Error("Session changed"); }, getValidAccessToken: () => mockToken(), forceRefreshAccessToken: () => mockRefresh(), isSessionIdentityCurrent: (value: typeof mockIdentity) => value.userId === mockIdentity.userId && value.generation === mockIdentity.generation, subscribeSession: () => () => {}, SessionIdentityChangedError: class extends Error {} }));
// eslint-disable-next-line import/first -- exercise the real request with isolated auth/network transports
import { supabasePost } from "../client";
const originalFetch = global.fetch;
beforeEach(() => { jest.clearAllMocks(); mockIdentity = { userId: "user-a", generation: 1 }; mockToken.mockResolvedValue("captured-token"); global.fetch = jest.fn(async () => ({ ok: true, status: 201, text: async () => "[]" } as Response)); });
afterAll(() => { global.fetch = originalFetch; });

test("rejects obsolete UI context before requesting credentials", async () => {
  await expect(supabasePost("/class_calendar_exceptions", [], undefined, undefined, () => { throw new Error("Context changed"); })).rejects.toThrow("Context changed");
  expect(mockToken).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

test.each(["context", "session"])("%s change during credential await cannot send the old write", async change => {
  let release!: (token: string) => void; let current = true;
  mockToken.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const job = supabasePost("/class_calendar_exceptions", [], undefined, { ...mockIdentity }, () => { if (!current) throw new Error("Context changed"); });
  if (change === "context") current = false; else mockIdentity = { userId: "user-b", generation: 2 };
  release("captured-token");
  await expect(job).rejects.toThrow("changed"); expect(fetch).not.toHaveBeenCalled();
});

test("a context change during token refresh prevents retrying the write", async () => {
  let current = true;
  jest.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 401, text: async () => "" } as Response);
  mockRefresh.mockImplementationOnce(async () => { current = false; return "new-token"; });
  await expect(supabasePost("/class_calendar_exceptions", [], undefined, { ...mockIdentity }, () => { if (!current) throw new Error("Context changed"); })).rejects.toThrow("Context changed");
  expect(fetch).toHaveBeenCalledTimes(1);
});
