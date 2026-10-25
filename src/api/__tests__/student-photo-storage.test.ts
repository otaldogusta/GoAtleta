import {
  getStudentPhotoAccessUrl,
  getStudentPhotoObjectPath,
} from "../student-photo-storage";

const mockGetValidAccessToken = jest.fn();
let mockIdentity = { userId: "user-a", generation: 0 };
let mockOrganizationId: string | null = "org-1";
let mockCacheGeneration = 0;

jest.mock("../../auth/session", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
  getSessionIdentity: () => ({ ...mockIdentity }),
  assertSessionIdentity: (identity: typeof mockIdentity) => {
    if (identity.userId !== mockIdentity.userId || identity.generation !== mockIdentity.generation) throw new Error("Session changed");
  },
  SessionIdentityChangedError: class extends Error { constructor() { super("Session changed"); } },
}));
jest.mock("../../db/client", () => ({
  getActiveOrganizationId: async () => mockOrganizationId,
  getReadCacheGeneration: () => mockCacheGeneration,
}));

jest.mock("../config", () => ({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

describe("student photo storage access", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIdentity = { userId: "user-a", generation: mockIdentity.generation + 1 };
    mockOrganizationId = "org-1";
    mockCacheGeneration += 1;
    mockGetValidAccessToken.mockResolvedValue("access-token");
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("extracts the object path from legacy public URLs", () => {
    expect(
      getStudentPhotoObjectPath(
        "https://project.supabase.co/storage/v1/object/public/student-photos/org-1/student-1/avatar?v=123"
      )
    ).toBe("org-1/student-1/avatar");
  });

  it("keeps external photos unchanged", async () => {
    await expect(getStudentPhotoAccessUrl("https://images.example.com/avatar.jpg")).resolves.toBe(
      "https://images.example.com/avatar.jpg"
    );
  });

  it("creates an authorized signed URL for the private student bucket", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        signedURL: "/object/sign/student-photos/org-1/student-1/avatar?token=signed-token",
      }),
    }) as typeof fetch;

    const result = await getStudentPhotoAccessUrl(
      "https://project.supabase.co/storage/v1/object/public/student-photos/org-1/student-1/avatar?v=456"
    );

    expect(result).toBe(
      "https://project.supabase.co/storage/v1/object/sign/student-photos/org-1/student-1/avatar?token=signed-token&v=456"
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "https://project.supabase.co/storage/v1/object/sign/student-photos/org-1/student-1/avatar",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "anon-key",
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ expiresIn: 3600 }),
      })
    );
  });

  const source = (id: string, version = 1) => `https://project.supabase.co/storage/v1/object/public/student-photos/org-1/${id}/avatar?v=${version}`;
  const signedResponse = (id = "student") => ({ ok: true, json: async () => ({ signedURL: `/object/sign/student-photos/org-1/${id}/avatar?token=fixture` }) });
  const flush = async () => { for (let step = 0; step < 40; step += 1) await Promise.resolve(); };

  it("shares pending signatures and keeps settled grants only until the existing TTL", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1000);
    global.fetch = jest.fn().mockResolvedValue(signedResponse()) as typeof fetch;
    try {
      const urls = await Promise.all(Array.from({ length: 4 }, () => getStudentPhotoAccessUrl(source("same"))));
      expect(new Set(urls).size).toBe(1);
      await getStudentPhotoAccessUrl(source("same"));
      expect(global.fetch).toHaveBeenCalledTimes(1);
      now.mockReturnValue(1000 + 51 * 60_000);
      await getStudentPhotoAccessUrl(source("same"));
      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally { now.mockRestore(); }
  });

  it("bounds cold signatures to six requests and eventually serves every requested photo", async () => {
    const releases: (() => void)[] = [];
    let active = 0, maximum = 0;
    global.fetch = jest.fn().mockImplementation(() => new Promise(resolve => {
      active += 1;
      maximum = Math.max(maximum, active);
      releases.push(() => { active -= 1; resolve(signedResponse()); });
    })) as typeof fetch;
    const all = Promise.all(Array.from({ length: 19 }, (_, index) => getStudentPhotoAccessUrl(source(`bounded-${index}`))));
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(6);
    for (let batch = 0; batch < 4; batch += 1) {
      releases.splice(0).forEach(release => release());
      await flush();
    }
    await expect(all).resolves.toHaveLength(19);
    expect(maximum).toBe(6);
  });

  it("cancels one observer without aborting another observer of the same signature", async () => {
    let release!: (value: ReturnType<typeof signedResponse>) => void;
    global.fetch = jest.fn().mockImplementation(() => new Promise(resolve => { release = resolve; })) as typeof fetch;
    const controller = new AbortController();
    const cancelled = getStudentPhotoAccessUrl(source("shared"), { signal: controller.signal }).catch(error => error);
    const remaining = getStudentPhotoAccessUrl(source("shared"));
    await flush();
    controller.abort();
    expect(await cancelled).toBeInstanceOf(Error);
    release(signedResponse());
    await expect(remaining).resolves.toContain("token=fixture");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not start queued signatures for a page that has left", async () => {
    const releases: (() => void)[] = [];
    global.fetch = jest.fn().mockImplementation(() => new Promise(resolve => {
      releases.push(() => resolve(signedResponse()));
    })) as typeof fetch;
    const controller = new AbortController();
    const requests = Array.from({ length: 20 }, (_, index) => getStudentPhotoAccessUrl(source(`cancel-${index}`), { signal: controller.signal }).catch(error => error));
    await flush();
    controller.abort();
    releases.splice(0).forEach(release => release());
    await Promise.all(requests);
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(6);
  });

  it("allows a new observer after the previous page cancelled the same URL", async () => {
    const releases: (() => void)[] = [];
    global.fetch = jest.fn().mockImplementation(() => new Promise(resolve => {
      releases.push(() => resolve(signedResponse()));
    })) as typeof fetch;
    const controller = new AbortController();
    const first = getStudentPhotoAccessUrl(source("return-page"), { signal: controller.signal }).catch(error => error);
    await flush();
    controller.abort();
    const returned = getStudentPhotoAccessUrl(source("return-page"));
    await flush();
    releases.splice(0).forEach(release => release());
    await expect(first).resolves.toBeInstanceOf(Error);
    await expect(returned).resolves.toContain("token=fixture");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("releases signing slots after a network timeout so later pages can proceed", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(new Error("timeout")), { once: true });
    })) as typeof fetch;
    try {
      const requests = Array.from({ length: 9 }, (_, index) => getStudentPhotoAccessUrl(source(`timeout-${index}`)).catch(error => error));
      await flush();
      expect(global.fetch).toHaveBeenCalledTimes(6);
      await jest.advanceTimersByTimeAsync(20_000);
      await flush();
      expect(global.fetch).toHaveBeenCalledTimes(9);
      await jest.advanceTimersByTimeAsync(20_000);
      const results = await Promise.all(requests);
      expect(results.every(result => result instanceof Error)).toBe(true);
    } finally { jest.useRealTimers(); }
  });

  it.each(["user", "organization"])("aborts six obsolete fetches on %s change so the new context does not wait for their timeout", async change => {
    const oldSignals: AbortSignal[] = [];
    global.fetch = jest.fn().mockImplementation((url: string, init: RequestInit) => {
      if (url.includes("new-context")) return Promise.resolve(signedResponse());
      oldSignals.push(init.signal as AbortSignal);
      return new Promise((_resolve, reject) => {
        init.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    }) as typeof fetch;
    const previous = Array.from({ length: 6 }, (_, index) => getStudentPhotoAccessUrl(source(`old-context-${index}`)).catch(error => error));
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(6);
    if (change === "user") mockIdentity = { userId: "user-b", generation: mockIdentity.generation + 1 };
    else { mockOrganizationId = "org-2"; mockCacheGeneration += 1; }
    await expect(getStudentPhotoAccessUrl(source("new-context"))).resolves.toContain("token=fixture");
    expect(oldSignals).toHaveLength(6);
    expect(oldSignals.every(signal => signal.aborted)).toBe(true);
    expect((await Promise.all(previous)).every(result => result instanceof Error)).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(7);
  });

  it("never sends a queued operation with another user's token", async () => {
    let release!: (token: string) => void;
    mockGetValidAccessToken.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    global.fetch = jest.fn() as typeof fetch;
    const request = getStudentPhotoAccessUrl(source("token-guard")).catch(error => error);
    await flush();
    mockIdentity = { userId: "user-b", generation: mockIdentity.generation + 1 };
    release("other-user-token");
    expect(await request).toBeInstanceOf(Error);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects old queued work before acquiring a new user's credentials", async () => {
    const releases: (() => void)[] = [];
    global.fetch = jest.fn().mockImplementation(() => new Promise(resolve => {
      releases.push(() => resolve(signedResponse()));
    })) as typeof fetch;
    const requests = Array.from({ length: 14 }, (_, index) => getStudentPhotoAccessUrl(source(`identity-queue-${index}`)).catch(error => error));
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(6);
    mockIdentity = { userId: "user-b", generation: mockIdentity.generation + 1 };
    mockGetValidAccessToken.mockResolvedValue("token-user-b");
    releases.splice(0).forEach(release => release());
    const results = await Promise.all(requests);
    expect(results.every(result => result instanceof Error)).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(6);
    expect(mockGetValidAccessToken).toHaveBeenCalledTimes(6);
  });

  it.each(["user", "organization", "organization round trip"])("does not reuse a settled grant after %s changes", async (change) => {
    global.fetch = jest.fn().mockResolvedValue(signedResponse()) as typeof fetch;
    await getStudentPhotoAccessUrl(source("scope"));
    if (change === "user") mockIdentity = { userId: "user-b", generation: mockIdentity.generation + 1 };
    else {
      mockOrganizationId = change === "organization" ? "org-2" : "org-1";
      mockCacheGeneration += change === "organization" ? 1 : 2;
    }
    await getStudentPhotoAccessUrl(source("scope"));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects an old response during JSON parsing and does not cache it for a later organization", async () => {
    let release!: (value: { signedURL: string }) => void;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => new Promise(resolve => { release = resolve; }) }) as typeof fetch;
    const request = getStudentPhotoAccessUrl(source("parse-guard")).catch(error => error);
    await flush();
    mockOrganizationId = "org-2";
    mockCacheGeneration += 1;
    release({ signedURL: "/object/sign/student-photos/org-1/old/avatar?token=old" });
    expect(await request).toBeInstanceOf(Error);
    mockOrganizationId = "org-1";
    mockCacheGeneration += 1;
    jest.mocked(global.fetch).mockResolvedValue(signedResponse() as Response);
    await expect(getStudentPhotoAccessUrl(source("parse-guard"))).resolves.not.toContain("token=old");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("preserves version invalidation and retries failures without caching a denied grant", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, text: async () => "denied" }).mockResolvedValue(signedResponse()) as typeof fetch;
    await expect(getStudentPhotoAccessUrl(source("retry"))).rejects.toThrow("denied");
    await expect(getStudentPhotoAccessUrl(source("retry"))).resolves.toContain("v=1");
    await expect(getStudentPhotoAccessUrl(source("retry", 2))).resolves.toContain("v=2");
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("requires the expected workspace and an authenticated identity before reading a grant", async () => {
    global.fetch = jest.fn().mockResolvedValue(signedResponse()) as typeof fetch;
    await expect(getStudentPhotoAccessUrl(source("wrong-org"), { organizationId: "other-org" })).rejects.toThrow();
    await expect(getStudentPhotoAccessUrl(source("wrong-path").replace("/org-1/", "/other-org/"), { organizationId: "org-1" })).rejects.toThrow();
    mockIdentity = { userId: "", generation: mockIdentity.generation + 1 };
    await expect(getStudentPhotoAccessUrl(source("anonymous"))).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("bounds settled grants to 512 and evicts the least recently used photo, not a recently viewed one", async () => {
    global.fetch = jest.fn().mockResolvedValue(signedResponse()) as typeof fetch;
    for (let index = 0; index < 512; index++) await getStudentPhotoAccessUrl(source(`lru-${index}`));
    await getStudentPhotoAccessUrl(source("lru-0"));
    expect(global.fetch).toHaveBeenCalledTimes(512);
    await getStudentPhotoAccessUrl(source("lru-512"));
    await getStudentPhotoAccessUrl(source("lru-0"));
    expect(global.fetch).toHaveBeenCalledTimes(513);
    await getStudentPhotoAccessUrl(source("lru-1"));
    expect(global.fetch).toHaveBeenCalledTimes(514);
  });

  it("removes all expired grants on the next access and never prolongs a grant's TTL on a hit", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1000);
    const set = jest.spyOn(Map.prototype, "set");
    global.fetch = jest.fn().mockResolvedValue(signedResponse()) as typeof fetch;
    try {
      await getStudentPhotoAccessUrl(source("expired-a"));
      await getStudentPhotoAccessUrl(source("expired-b"));
      const index = set.mock.calls.findIndex(([key, value]) => typeof key === "string" && key.includes("expired-a") &&
        value && typeof value === "object" && "expiresAt" in value);
      // Observe the real private cache at its Map boundary; no production test API.
      expect(index).toBeGreaterThanOrEqual(0);
      const retained = set.mock.contexts[index] as Map<string, { url: string; expiresAt: number }>;
      expect(retained.size).toBe(2);
      now.mockReturnValue(1000 + 49 * 60_000);
      await getStudentPhotoAccessUrl(source("expired-a"));
      expect(global.fetch).toHaveBeenCalledTimes(2);
      now.mockReturnValue(1000 + 51 * 60_000);
      await getStudentPhotoAccessUrl(source("fresh-c"));
      expect(retained.size).toBe(1);
      expect([...retained.keys()][0]).toContain("fresh-c");
      await getStudentPhotoAccessUrl(source("expired-a"));
      expect(global.fetch).toHaveBeenCalledTimes(4);
    } finally { set.mockRestore(); now.mockRestore(); }
  });
});
