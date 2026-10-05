const mockValues = new Map<string, string>();
const mockStorage = {
  getItem: jest.fn(async (key: string) => mockValues.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockValues.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockValues.delete(key); }),
  getAllKeys: jest.fn(async () => [...mockValues.keys()]),
  multiRemove: jest.fn(async (keys: string[]) => { keys.forEach((key) => mockValues.delete(key)); }),
};
const sessionFor = (userId: string) => ({
  access_token: `token-${userId}`, refresh_token: `refresh-${userId}`, expires_at: 9999999999,
  user: { id: userId, email: `${userId}@example.test`, app_metadata: { email_verified_hybrid_at: "2026-10-05T12:00:00.000Z" } },
});
const input = {
  organizationId: "org-A", recipientUserId: "recipient-A", inboxScope: "student" as const,
  type: "consultation_event" as const, title: "Treino publicado", body: "Treino disponível.",
};
const pushInput = { organizationId: "org-A", targetUserId: "recipient-A", title: input.title, body: input.body };
function gate() {
  let release!: () => void;
  let entered!: () => void;
  return {
    pending: new Promise<void>((resolve) => { release = resolve; }),
    started: new Promise<void>((resolve) => { entered = resolve; }),
    release: () => release(), enter: () => entered(),
  };
}

async function setup() {
  jest.resetModules();
  mockValues.clear();
  jest.clearAllMocks();
  jest.doMock("@react-native-async-storage/async-storage", () => mockStorage);
  jest.doMock("react-native", () => ({ Platform: { OS: "web" } }));
  jest.doMock("expo-secure-store", () => ({ getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} }));
  jest.doMock("@sentry/react-native", () => ({ addBreadcrumb: jest.fn(), setContext: jest.fn() }));
  jest.doMock("../config", () => ({ SUPABASE_URL: "https://example.test", SUPABASE_ANON_KEY: "dummy" }));
  const auth = jest.requireActual<typeof import("../../auth/session")>("../../auth/session");
  const client = jest.requireActual<typeof import("../../db/client")>("../../db/client");
  const contexts = jest.requireActual<typeof import("../../db/consultation-context")>("../../db/consultation-context");
  const notifications = jest.requireActual<typeof import("../notifications")>("../notifications");
  const push = jest.requireActual<typeof import("../push")>("../push");
  const inbox = jest.requireActual<typeof import("../../notificationsInbox")>("../../notificationsInbox");
  await auth.saveSession(sessionFor("A"));
  mockValues.set("active-org-id", "org-A");
  const context = await contexts.captureConsultationContext();
  const assertCurrent = () => contexts.assertConsultationContext(context);
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
    notification: { id: "notification-A", organization_id: "org-A", recipient_user_id: "recipient-A",
      inbox_scope: "student", actor_user_id: "A", type: input.type, title: input.title, body: input.body,
      created_at: "2026-10-05T12:00:00Z" },
  }), { status: 200 }));
  const change = async (kind: "account" | "organization") => {
    if (kind === "account") await auth.saveSession(sessionFor("B"));
    else {
      await client.clearLocalReadCaches();
      mockValues.set("active-org-id", "org-B");
    }
  };
  return { auth, notifications, push, inbox, assertCurrent, fetchMock, change };
}

afterEach(() => { jest.restoreAllMocks(); });

test("notification guard rejects an account switch during actor/user resolution before fetch", async () => {
  const ctx = await setup();
  const waiting = gate();
  const actualGetUserId = ctx.auth.getSessionUserId;
  jest.spyOn(ctx.auth, "getSessionUserId").mockImplementationOnce(async () => {
    waiting.enter();
    await waiting.pending;
    return actualGetUserId();
  });
  const sending = ctx.notifications.createNotification(input, ctx.assertCurrent);
  const rejected = expect(sending).rejects.toThrow("sessão mudou");
  await waiting.started;
  await ctx.change("account");
  waiting.release();
  await rejected;
  expect(ctx.fetchMock).not.toHaveBeenCalled();
});

test.each(["account", "organization"] as const)("notification guard rejects %s switch during token acquisition", async (kind) => {
  const ctx = await setup();
  const waiting = gate();
  const actualGetToken = ctx.auth.getValidAccessToken;
  jest.spyOn(ctx.auth, "getValidAccessToken").mockImplementationOnce(async () => {
    waiting.enter();
    await waiting.pending;
    return actualGetToken();
  });
  const sending = ctx.notifications.createNotification(input, ctx.assertCurrent);
  const rejected = expect(sending).rejects.toThrow("sessão mudou");
  await waiting.started;
  await ctx.change(kind);
  waiting.release();
  await rejected;
  expect(ctx.fetchMock).not.toHaveBeenCalled();
});

test.each(["account", "organization"] as const)("push guard rejects %s switch during token acquisition", async (kind) => {
  const ctx = await setup();
  const waiting = gate();
  const actualGetToken = ctx.auth.getValidAccessToken;
  jest.spyOn(ctx.auth, "getValidAccessToken").mockImplementationOnce(async () => {
    waiting.enter();
    await waiting.pending;
    return actualGetToken();
  });
  const sending = ctx.push.sendPushToUser(pushInput, ctx.assertCurrent);
  const rejected = expect(sending).rejects.toThrow("sessão mudou");
  await waiting.started;
  await ctx.change(kind);
  waiting.release();
  await rejected;
  expect(ctx.fetchMock).not.toHaveBeenCalled();
});

test("inbox forwards the guard through the real create helper and does not refresh after cancellation", async () => {
  const ctx = await setup();
  const waiting = gate();
  const actualGetToken = ctx.auth.getValidAccessToken;
  jest.spyOn(ctx.auth, "getValidAccessToken").mockImplementationOnce(async () => {
    waiting.enter();
    await waiting.pending;
    return actualGetToken();
  });
  const sending = ctx.inbox.addNotification(input.title, input.body, input, ctx.assertCurrent);
  await waiting.started;
  await ctx.change("organization");
  waiting.release();
  await expect(sending).resolves.toBeNull();
  expect(ctx.fetchMock).not.toHaveBeenCalled();
});

test("optional automatic push receives the guard after the inbox notification is persisted", async () => {
  const ctx = await setup();
  const waiting = gate();
  const actualGetToken = ctx.auth.getValidAccessToken;
  jest.spyOn(ctx.auth, "getValidAccessToken")
    .mockImplementationOnce(actualGetToken)
    .mockImplementationOnce(async () => {
      waiting.enter();
      await waiting.pending;
      return actualGetToken();
    });
  const sending = ctx.notifications.createNotification({ ...input, sendPush: true }, ctx.assertCurrent);
  await waiting.started;
  await ctx.change("account");
  waiting.release();
  // The first send already completed; best-effort push must not send under B's token.
  await expect(sending).resolves.toMatchObject({ id: "notification-A" });
  expect(ctx.fetchMock).toHaveBeenCalledTimes(1);
  expect(String(ctx.fetchMock.mock.calls[0][0])).toContain("/create-notification");
});

test("a current guard sends with the token already captured, without acquiring another token", async () => {
  const ctx = await setup();
  const tokenSpy = jest.spyOn(ctx.auth, "getValidAccessToken");
  await expect(ctx.notifications.createNotification(input, ctx.assertCurrent)).resolves.toMatchObject({ id: "notification-A" });
  expect(tokenSpy).toHaveBeenCalledTimes(1);
  expect(ctx.fetchMock).toHaveBeenCalledWith(expect.stringContaining("/create-notification"), expect.objectContaining({
    headers: expect.objectContaining({ Authorization: "Bearer token-A" }),
  }));
});
