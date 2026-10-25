let mockIdentity = { userId: "user-a", generation: 1 };
const mockValues = new Map<string, string>();
const mockLegacy = new Map<string, string>();
const mockGet = jest.fn(async (key: string) => mockValues.get(key) ?? null);
const mockSet = jest.fn(async (key: string, value: string) => { mockValues.set(key, value); });
const mockRemove = jest.fn(async (key: string) => { mockValues.delete(key); });
const mockClear = jest.fn(async () => { mockValues.clear(); });
const mockStorage = {
  getItem: jest.fn(async (key: string) => mockLegacy.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockLegacy.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockLegacy.delete(key); }),
  getAllKeys: jest.fn(async () => [...mockLegacy.keys()]),
  multiRemove: jest.fn(async (keys: string[]) => { keys.forEach(key => mockLegacy.delete(key)); }),
};
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (key: string) => mockStorage.getItem(key), setItem: (key: string, value: string) => mockStorage.setItem(key, value),
  removeItem: (key: string) => mockStorage.removeItem(key), getAllKeys: () => mockStorage.getAllKeys(),
  multiRemove: (keys: string[]) => mockStorage.multiRemove(keys),
}));
jest.mock("../read-cache-storage", () => ({ getReadCacheItem: (...args: [string]) => mockGet(...args),
  setReadCacheItem: (...args: [string, string]) => mockSet(...args), removeReadCacheItem: (...args: [string]) => mockRemove(...args), clearReadCacheStorage: () => mockClear() }));
jest.mock("../../auth/session", () => ({ getSessionIdentity: () => ({ ...mockIdentity }),
  isSessionIdentityCurrent: (value: typeof mockIdentity) => value.userId === mockIdentity.userId && value.generation === mockIdentity.generation,
  subscribeSession: () => () => {}, assertSessionIdentity: jest.fn(), SessionIdentityChangedError: class extends Error {} }));
jest.mock("../../api/config", () => ({ SUPABASE_URL: "https://fixture.test", SUPABASE_ANON_KEY: "fixture" }));
jest.mock("@sentry/react-native", () => ({ addBreadcrumb() {}, setContext() {} }));
// eslint-disable-next-line import/first -- real client uses isolated cache backends
import { clearLocalReadCaches, getReadCacheGeneration, readCache, writeCache } from "../client";
beforeEach(() => {
  jest.clearAllMocks(); mockValues.clear(); mockLegacy.clear(); mockLegacy.set("active-org-id", "org-a");
  mockIdentity = { userId: "user-a", generation: 1 };
});
test("read caches use the scoped adapter while preferences and pending/auth keys remain in AsyncStorage", async () => {
  await writeCache("cache_students_v1_org-a", [{ id: "a" }]);
  expect(mockSet).toHaveBeenCalledWith("read-cache:v2:user-a:org-a:cache_students_v1_org-a", '[{"id":"a"}]');
  expect(await readCache("cache_students_v1_org-a")).toEqual([{ id: "a" }]);
  await writeCache("pending_writes_v1", { durable: true }); await writeCache("theme", "dark");
  expect(mockStorage.setItem).toHaveBeenCalledTimes(2); expect(mockSet).toHaveBeenCalledTimes(1);
  expect(await readCache("theme")).toBe("dark");
});
test("identity changes during an adapter read discard the old full detail", async () => {
  mockGet.mockImplementationOnce(async () => { mockIdentity = { userId: "user-b", generation: 2 }; return '{"private":"a"}'; });
  expect(await readCache("cache_students_v1_org-a_details")).toBeNull();
});
test("a generation change during commit removes only the old scoped adapter entry", async () => {
  mockSet.mockImplementationOnce(async (key, value) => { mockValues.set(key, value); await clearLocalReadCaches(); });
  await writeCache("cache_students_v1_org-a_details", { private: "a" });
  expect(mockRemove).toHaveBeenCalledWith("read-cache:v2:user-a:org-a:cache_students_v1_org-a_details");
  expect(mockStorage.removeItem).not.toHaveBeenCalled();
});
test.each(["legacy", "adapter"])("cleanup attempts both stores independently when %s fails and preserves auth/durable keys", async failure => {
  mockLegacy.set("cache_students_v1", "legacy"); mockLegacy.set("session", "auth"); mockLegacy.set("pending_writes_v1", "draft");
  if (failure === "legacy") mockStorage.getAllKeys.mockRejectedValueOnce(new Error("Unavailable"));
  else mockClear.mockRejectedValueOnce(new Error("Unavailable"));
  const before = getReadCacheGeneration(); await clearLocalReadCaches();
  expect(getReadCacheGeneration()).toBe(before + 1); expect(mockStorage.getAllKeys).toHaveBeenCalledTimes(1); expect(mockClear).toHaveBeenCalledTimes(1);
  expect(mockLegacy.get("session")).toBe("auth"); expect(mockLegacy.get("pending_writes_v1")).toBe("draft");
});
test("unavailable storage remains best-effort without writing back to localStorage", async () => {
  mockSet.mockRejectedValueOnce(new Error("QuotaExceededError"));
  await expect(writeCache("cache_students_v1_org-a_details", { id: "a" })).resolves.toBeUndefined();
  expect(mockStorage.setItem).not.toHaveBeenCalled();
  mockGet.mockRejectedValueOnce(new Error("Unavailable"));
  expect(await readCache("cache_students_v1_org-a_details")).toBeNull();
});
