const mockStorageValues = new Map<string, string>();
const mockStorage = {
  getItem: jest.fn(async (key: string) => mockStorageValues.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorageValues.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStorageValues.delete(key); }),
  getAllKeys: jest.fn(async () => [...mockStorageValues.keys()]),
  multiRemove: jest.fn(async (keys: string[]) => { keys.forEach(key => mockStorageValues.delete(key)); }),
};
const sessionFor = (userId: string, token = `token-${userId}`) => ({
  access_token: token, refresh_token: `refresh-${userId}`, expires_at: 9999999999,
  user: { id: userId, email: `${userId}@example.test`, app_metadata: { email_verified_hybrid_at: "2026-10-23T12:00:00Z" } },
});
const notificationRow = (id = "n-a") => ({
  id, organization_id: "org-a", recipient_user_id: "A", actor_user_id: null, inbox_scope: "prof",
  type: "generic", title: "Aviso fictício", body: "Conteúdo de teste", action_url: null,
  source_type: null, source_id: null, metadata: {}, read_at: null, archived_at: null,
  created_at: "2026-10-23T12:00:00Z",
});
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const deferred = <T>() => {
  let release!: (value: T) => void;
  const promise = new Promise<T>(resolve => { release = resolve; });
  return { promise, release };
};

async function setup() {
  jest.resetModules();
  jest.clearAllMocks();
  mockStorageValues.clear();
  jest.doMock("@react-native-async-storage/async-storage", () => mockStorage);
  jest.doMock("react-native", () => ({ Platform: { OS: "web" } }));
  jest.doMock("expo-secure-store", () => ({ getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} }));
  jest.doMock("@sentry/react-native", () => ({ addBreadcrumb: jest.fn(), setContext: jest.fn() }));
  jest.doMock("../config", () => ({ SUPABASE_URL: "https://example.test", SUPABASE_ANON_KEY: "dummy" }));
  const auth = jest.requireActual<typeof import("../../auth/session")>("../../auth/session");
  const client = jest.requireActual<typeof import("../../db/client")>("../../db/client");
  const notifications = jest.requireActual<typeof import("../notifications")>("../notifications");
  const rest = jest.requireActual<typeof import("../rest")>("../rest");
  await auth.saveSession(sessionFor("A"));
  mockStorageValues.set("active-org-id", "org-a");
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(response([notificationRow()]));
  return { auth, client, notifications, rest, fetchMock };
}
async function started(fetchMock: jest.SpyInstance, count = 1) {
  for (let tick = 0; tick < 100 && fetchMock.mock.calls.length < count; tick++) await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledTimes(count);
}
afterEach(() => jest.restoreAllMocks());

test("four concurrent inbox consumers share one GET, with a fresh GET after settlement", async () => {
  const { notifications, fetchMock } = await setup();
  const waiting = deferred<Response>();
  fetchMock.mockReturnValueOnce(waiting.promise);
  const reads = Array.from({ length: 4 }, () => notifications.listNotifications({ inboxScope: "prof" }));
  await started(fetchMock);
  waiting.release(response([notificationRow()]));
  const results = await Promise.all(reads);
  expect(results).toHaveLength(4);
  results.forEach(result => expect(result[0].id).toBe("n-a"));
  fetchMock.mockResolvedValueOnce(response([notificationRow("n-new")]));
  await expect(notifications.listNotifications({ inboxScope: "prof" })).resolves.toEqual([expect.objectContaining({ id: "n-new" })]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("organization, inbox, pagination, unread and archive filters remain separate in flight", async () => {
  const { notifications, fetchMock } = await setup();
  const waiting = deferred<Response>();
  fetchMock.mockImplementation(() => waiting.promise.then(() => response([])));
  const options = { inboxScope: "prof" as const, organizationId: "org-a" };
  const reads = [options, { ...options, organizationId: "org-b" }, { ...options, inboxScope: "coord" as const },
    { ...options, limit: 20 }, { ...options, offset: 20 }, { ...options, unreadOnly: true },
    { ...options, archiveScope: "archived" as const }, { ...options, archiveScope: "all" as const }]
    .map(value => notifications.listNotifications(value));
  await started(fetchMock, 8);
  waiting.release(response([]));
  await Promise.all(reads);
  const paths = fetchMock.mock.calls.map(([url]) => String(url));
  expect(new Set(paths).size).toBe(8);
});

test.each(["logout", "other account", "workspace round trip"])("rejects a shared response after %s", async (change) => {
  const { auth, client, notifications, fetchMock } = await setup();
  const waiting = deferred<Response>();
  fetchMock.mockReturnValueOnce(waiting.promise);
  const reads = Promise.all([notifications.listNotifications({ inboxScope: "prof" }), notifications.listNotifications({ inboxScope: "prof" })]);
  const rejected = expect(reads).rejects.toBeInstanceOf(auth.SessionIdentityChangedError);
  await started(fetchMock);
  if (change === "logout") await auth.saveSession(null);
  else if (change === "other account") await auth.saveSession(sessionFor("B"));
  else {
    await client.clearLocalReadCaches();
    mockStorageValues.set("active-org-id", "org-b");
    await client.clearLocalReadCaches();
    mockStorageValues.set("active-org-id", "org-a");
  }
  waiting.release(response([notificationRow()]));
  await rejected;
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("a token rotation does not join a request started with the previous token", async () => {
  const { auth, notifications, fetchMock } = await setup();
  const waiting = deferred<Response>();
  fetchMock.mockReturnValueOnce(waiting.promise);
  const first = notifications.listNotifications({ inboxScope: "prof" });
  await started(fetchMock);
  await auth.saveSession(sessionFor("A", "rotated-token-A"));
  const second = notifications.listNotifications({ inboxScope: "prof" });
  await started(fetchMock, 2);
  waiting.release(response([]));
  await Promise.all([first, second]);
  expect(fetchMock.mock.calls.map(([, init]) => (init?.headers as Record<string, string>).Authorization))
    .toEqual(["Bearer token-A", "Bearer rotated-token-A"]);
});

test("a read mutation invalidates old responses and refresh does not join the pre-write GET", async () => {
  const { notifications, fetchMock } = await setup();
  const waiting = deferred<Response>();
  fetchMock.mockReturnValueOnce(waiting.promise);
  const old = notifications.listNotifications({ inboxScope: "prof" });
  await started(fetchMock);
  fetchMock.mockResolvedValueOnce(response(null));
  await notifications.markNotificationRead("n-a");
  const refreshed = deferred<Response>();
  fetchMock.mockReturnValueOnce(refreshed.promise);
  const fresh = notifications.listNotifications({ inboxScope: "prof" });
  await started(fetchMock, 3);
  waiting.release(response([notificationRow("n-stale")]));
  for (let tick = 0; tick < 100; tick++) await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  refreshed.release(response([notificationRow("n-fresh")]));
  await expect(old).resolves.toEqual([expect.objectContaining({ id: "n-fresh" })]);
  await expect(fresh).resolves.toEqual([expect.objectContaining({ id: "n-fresh" })]);
  expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "PATCH", "GET"]);
});

test("a late readAll consumer preserves the newest emitted inbox through two successive mutations", async () => {
  const { fetchMock } = await setup();
  const inbox = jest.requireActual<typeof import("../../notificationsInbox")>("../../notificationsInbox");
  const original = deferred<Response>(), replay = deferred<Response>();
  let version = 0, first = true, pauseNextGet = false;
  fetchMock.mockImplementation(async (_url, init) => {
    if (init?.method === "PATCH") { version++; return response(null); }
    if (first) { first = false; return original.promise; }
    if (pauseNextGet) { pauseNextGet = false; return replay.promise; }
    return response([notificationRow(`fresh-${version}`)]);
  });
  const published: string[][] = [];
  const unsubscribe = inbox.subscribeNotifications(items => published.push(items.map(item => item.id)), "prof", "org-a");
  try {
    const old = Promise.all(Array.from({ length: 2 }, () => inbox.getNotifications("prof", "org-a").then(items => {
      published.push(items.map(item => item.id));
      return items;
    })));
    await started(fetchMock);
    await inbox.markNotificationRead("n-a", "prof", "org-a");
    expect(published).toEqual([["fresh-1"]]);
    pauseNextGet = true;
    original.release(response([notificationRow("stale")]));
    await started(fetchMock, 4);
    await inbox.markNotificationRead("n-a", "prof", "org-a");
    expect(published).toEqual([["fresh-1"], ["fresh-2"]]);
    replay.release(response([notificationRow("fresh-1")]));
    await expect(old).resolves.toEqual([
      [expect.objectContaining({ id: "fresh-2" })], [expect.objectContaining({ id: "fresh-2" })],
    ]);
    expect(published).toEqual([["fresh-1"], ["fresh-2"], ["fresh-2"], ["fresh-2"]]);
    expect(fetchMock).toHaveBeenCalledTimes(7);
  } finally { unsubscribe(); }
});

test("a failed shared request is removed so the next reload can recover", async () => {
  const { notifications, fetchMock } = await setup();
  fetchMock.mockRejectedValueOnce(new Error("Failed to fetch"));
  await expect(Promise.all([notifications.listNotifications({ inboxScope: "prof" }), notifications.listNotifications({ inboxScope: "prof" })])).rejects.toThrow("Failed to fetch");
  fetchMock.mockResolvedValueOnce(response([]));
  await expect(notifications.listNotifications({ inboxScope: "prof" })).resolves.toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("legacy archived-column fallback is also shared by concurrent readers", async () => {
  const { notifications, fetchMock } = await setup();
  fetchMock.mockResolvedValueOnce(response({ message: "column archived_at does not exist" }, 400))
    .mockResolvedValueOnce(response([notificationRow()]));
  const reads = await Promise.all(Array.from({ length: 4 }, () => notifications.listNotifications({ inboxScope: "prof" })));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  reads.forEach(result => expect(result[0].archived).toBe(false));
});

test("guarded REST stops before retrying a 401 if the user changed before its response", async () => {
  const { auth, rest, fetchMock } = await setup();
  const identity = auth.getSessionIdentity();
  const refresh = jest.spyOn(auth, "forceRefreshAccessToken");
  fetchMock.mockImplementationOnce(async () => {
    await auth.saveSession(sessionFor("B"));
    return response(null, 401);
  });
  await expect(rest.supabaseRestGet("/notifications", () => auth.assertSessionIdentity(identity))).rejects.toBeInstanceOf(auth.SessionIdentityChangedError);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(refresh).not.toHaveBeenCalled();
});

test("guarded REST never retries the old request with another user's token after refresh", async () => {
  const { auth, rest, fetchMock } = await setup();
  const identity = auth.getSessionIdentity();
  fetchMock.mockResolvedValueOnce(response(null, 401));
  jest.spyOn(auth, "forceRefreshAccessToken").mockImplementationOnce(async () => {
    await auth.saveSession(sessionFor("B"));
    return "token-B";
  });
  await expect(rest.supabaseRestRequest("/rpc/example", { method: "POST", body: {}, assertContextCurrent: () => auth.assertSessionIdentity(identity) })).rejects.toBeInstanceOf(auth.SessionIdentityChangedError);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer token-A");
});

test("guarded REST retains the normal 401 retry when the same user's token refreshes", async () => {
  const { auth, rest, fetchMock } = await setup();
  const identity = auth.getSessionIdentity();
  fetchMock.mockResolvedValueOnce(response(null, 401)).mockResolvedValueOnce(response([]));
  jest.spyOn(auth, "forceRefreshAccessToken").mockImplementationOnce(async () => {
    await auth.saveSession(sessionFor("A", "refreshed-token-A"));
    return "refreshed-token-A";
  });
  await expect(rest.supabaseRestGet("/notifications", () => auth.assertSessionIdentity(identity))).resolves.toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBe("Bearer refreshed-token-A");
});
