import * as Sentry from "@sentry/react-native";
import type { ProfileRecord } from "../../core/class-pedagogical-profile";
import type { ClassGroup } from "../../core/models";
import { assertSessionIdentity, SessionIdentityChangedError } from "../../auth/session";
import { getClassPedagogicalProfiles } from "../class-pedagogical-profile";
import { getClassById, getClasses } from "../classes";
import {
  getScopedOrganizationId,
  getReadCacheGeneration,
  isAuthError,
  readCache,
  supabaseGet,
  writeCache,
} from "../client";

jest.mock("@sentry/react-native", () => ({ addBreadcrumb: jest.fn() }));
jest.mock("../../auth/session", () => ({
  getSessionUserId: jest.fn(),
  getSessionIdentity: jest.fn(() => ({ userId: "teacher-1", generation: 1 })),
  assertSessionIdentity: jest.fn(),
  SessionIdentityChangedError: class extends Error {
    constructor() { super("A sessão mudou. Abra novamente esta operação."); }
  },
}));
jest.mock("../training-sessions", () => ({
  deleteTrainingIntegrationRuleBySession: jest.fn(),
  syncTrainingIntegrationRuleFromSession: jest.fn(),
}));
jest.mock("../class-pedagogical-profile", () => ({
  getClassPedagogicalProfiles: jest.fn(),
}));
jest.mock("../client", () => ({
  CACHE_KEYS: { classes: "cache_classes_v1" },
  getActiveOrganizationId: jest.fn(async () => "org-1"),
  getScopedOrganizationId: jest.fn(),
  getReadCacheGeneration: jest.fn(() => 1),
  isAuthError: jest.fn(() => false),
  isMissingRelation: jest.fn(() => false),
  isNetworkError: (error: unknown) => error instanceof Error && error.message === "Network request failed",
  isPermissionError: jest.fn(() => false),
  readCache: jest.fn(),
  writeCache: jest.fn(),
  supabaseGet: jest.fn(),
}));

const classRows = [{
  id: "class-1", name: "Turma", organization_id: "org-1", unit_id: "unit-1",
  unit: "Unidade antiga", modality: "voleibol", ageband: "10-12", gender: "misto",
  starttime: "14:00", duration: 60, days: [2], daysperweek: 1,
  goal: "Fundamentos", equipment: "quadra", level: 1,
  created_at: "2026-10-23T12:00:00Z",
}];
const profile = { class_id: "class-1", version: 7 } as ProfileRecord;
const delay = <T>(value: T, ms: number): Promise<T> =>
  new Promise(resolve => setTimeout(() => resolve(value), ms));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(assertSessionIdentity).mockReset();
  jest.mocked(getReadCacheGeneration).mockReturnValue(1);
  jest.mocked(isAuthError).mockImplementation(error => error instanceof SessionIdentityChangedError);
  jest.mocked(getScopedOrganizationId).mockResolvedValue("org-1");
  jest.mocked(supabaseGet).mockImplementation(async path =>
    path.startsWith("/units?") ? [{ id: "unit-1", name: "Unidade atual" }] : classRows,
  );
  jest.mocked(getClassPedagogicalProfiles).mockResolvedValue([profile]);
  jest.mocked(writeCache).mockResolvedValue(undefined);
  jest.mocked(readCache).mockResolvedValue([]);
});

afterEach(() => jest.useRealTimers());

describe("getClassById availability", () => {
  it("returns null only when the scoped query succeeds without a row", async () => {
    jest.mocked(supabaseGet).mockImplementation(async path => path.startsWith("/units?") ? [] : []);
    await expect(getClassById("class-1", { organizationId: "org-1" })).resolves.toBeNull();
    expect(supabaseGet).toHaveBeenCalledWith(expect.stringContaining("id=eq.class-1&organization_id=eq.org-1"));
    expect(readCache).not.toHaveBeenCalled();
  });

  it("keeps a missing offline class as a network error instead of not found", async () => {
    const error = new Error("Network request failed");
    jest.mocked(supabaseGet).mockImplementation(async path => { if (path.startsWith("/units?")) return []; throw error; });
    jest.mocked(readCache).mockResolvedValue([]);
    await expect(getClassById("class-1", { organizationId: "org-1" })).rejects.toBe(error);
    expect(readCache).toHaveBeenCalledWith("cache_classes_v1_org-1");
  });

  it("preserves an available class from the same organization's offline cache", async () => {
    const cached = { id: "class-1", organizationId: "org-1", name: "Turma" } as ClassGroup;
    jest.mocked(supabaseGet).mockImplementation(async path => { if (path.startsWith("/units?")) return []; throw new Error("Network request failed"); });
    jest.mocked(readCache).mockResolvedValue([cached]);
    await expect(getClassById("class-1", { organizationId: "org-1" })).resolves.toEqual(expect.objectContaining(cached));
  });

  it("does not fall back to cache after a permission failure", async () => {
    const error = new Error("permission denied");
    jest.mocked(supabaseGet).mockImplementation(async path => { if (path.startsWith("/units?")) return []; throw error; });
    await expect(getClassById("class-1", { organizationId: "org-1" })).rejects.toBe(error);
    expect(readCache).not.toHaveBeenCalled();
  });
});

describe("getClasses read performance and contracts", () => {
  it("overlaps independent unit and class reads and measures through fresh profiles", async () => {
    jest.useFakeTimers({ now: 0 });
    const starts: { path: string; at: number }[] = [];
    jest.mocked(supabaseGet).mockImplementation(path => {
      starts.push({ path: path.split("?")[0], at: Date.now() });
      return delay(path.startsWith("/units?") ? [{ id: "unit-1", name: "Unidade atual" }] : classRows, 100);
    });
    jest.mocked(writeCache).mockImplementation(() => delay(undefined, 25));
    jest.mocked(getClassPedagogicalProfiles).mockImplementation(() => delay([profile], 100));

    const startedAt = Date.now();
    const pending = getClasses({ organizationId: "org-1" });
    await jest.runAllTimersAsync();
    const result = await pending;

    // Controlled workload: 100 ms per remote read, 25 ms cache persistence.
    // This verifies the waterfall, not a production latency or FPS budget.
    expect(Date.now() - startedAt).toBe(225);
    expect(starts).toEqual([{ path: "/units", at: 0 }, { path: "/classes", at: 0 }]);
    expect(result).toEqual([expect.objectContaining({
      id: "class-1", unit: "Unidade atual", pedagogicalProfile: profile,
    })]);
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
      message: "getClasses", data: { ms: 225, rows: 1 },
    }));
  });

  it("does not request units or classes without an organization", async () => {
    jest.mocked(getScopedOrganizationId).mockResolvedValue(null);
    await expect(getClasses()).resolves.toEqual([]);
    expect(supabaseGet).not.toHaveBeenCalled();
    expect(getClassPedagogicalProfiles).not.toHaveBeenCalled();
  });

  it("keeps the newest class cache available if fetching fresh profiles fails on the network", async () => {
    let cached: ClassGroup[] = [];
    jest.mocked(writeCache).mockImplementation(async (_key, value) => { cached = value as ClassGroup[]; });
    jest.mocked(readCache).mockImplementation(async () => cached);
    jest.mocked(getClassPedagogicalProfiles).mockRejectedValue(new Error("Network request failed"));

    await expect(getClasses({ organizationId: "org-1" })).resolves.toEqual([
      expect.objectContaining({ id: "class-1", unit: "Unidade atual", pedagogicalProfileUnavailable: true }),
    ]);
    expect(cached[0]).not.toHaveProperty("pedagogicalProfile");
    expect(readCache).toHaveBeenCalledWith("cache_classes_v1_org-1");
  });

  it("does not substitute cache for a permission or identity failure", async () => {
    const error = new Error("A sessão mudou. Tente novamente.");
    jest.mocked(supabaseGet).mockRejectedValue(error);
    await expect(getClasses({ organizationId: "org-1" })).rejects.toBe(error);
    expect(readCache).not.toHaveBeenCalled();
    expect(writeCache).not.toHaveBeenCalled();
    expect(getClassPedagogicalProfiles).not.toHaveBeenCalled();
  });

  it("keeps simultaneous organizations in distinct queries and cache keys", async () => {
    jest.mocked(getScopedOrganizationId).mockImplementation(async candidate => candidate ?? null);
    await Promise.all([getClasses({ organizationId: "org-1" }), getClasses({ organizationId: "org-2" })]);
    expect(supabaseGet).toHaveBeenCalledWith(expect.stringContaining("organization_id=eq.org-1"), { userId: "teacher-1", generation: 1 });
    expect(supabaseGet).toHaveBeenCalledWith(expect.stringContaining("organization_id=eq.org-2"), { userId: "teacher-1", generation: 1 });
    expect(writeCache).toHaveBeenCalledWith("cache_classes_v1_org-1", expect.any(Array));
    expect(writeCache).toHaveBeenCalledWith("cache_classes_v1_org-2", expect.any(Array));
    expect(getClassPedagogicalProfiles).toHaveBeenCalledWith("org-1");
    expect(getClassPedagogicalProfiles).toHaveBeenCalledWith("org-2");
  });

  it.each(["account", "workspace"])("rejects %s changes when the classes finish before the units", async kind => {
    let rejectUnits!: (error: Error) => void;
    const error = new SessionIdentityChangedError();
    jest.mocked(supabaseGet).mockImplementation(path => path.startsWith("/units?")
      ? new Promise((_resolve, reject) => { rejectUnits = reject; })
      : Promise.resolve(classRows));
    const pending = getClasses({ organizationId: "org-1" });
    for (let tick = 0; tick < 10; tick++) await Promise.resolve();
    expect(supabaseGet).toHaveBeenCalledTimes(2);
    if (kind === "account") jest.mocked(assertSessionIdentity).mockImplementation(() => { throw error; });
    else jest.mocked(getReadCacheGeneration).mockReturnValue(2);
    // safeGetUnits intentionally tolerates auth failures. The compound operation
    // must still reject instead of caching class rows from the previous context.
    const rejected = expect(pending).rejects.toBeInstanceOf(SessionIdentityChangedError);
    rejectUnits(error);
    await rejected;
    expect(writeCache).not.toHaveBeenCalled();
    expect(readCache).not.toHaveBeenCalled();
    expect(getClassPedagogicalProfiles).not.toHaveBeenCalled();
  });

  it("rejects a workspace switch while fresh profiles are being fetched", async () => {
    jest.mocked(getClassPedagogicalProfiles).mockImplementation(async () => {
      jest.mocked(getReadCacheGeneration).mockReturnValue(2);
      return [profile];
    });
    await expect(getClasses({ organizationId: "org-1" })).rejects.toBeInstanceOf(SessionIdentityChangedError);
    expect(readCache).not.toHaveBeenCalled();
  });
});
