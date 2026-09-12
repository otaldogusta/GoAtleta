/* eslint-disable import/first */
const mockGetValidAccessToken = jest.fn();

jest.mock("../../auth/session", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}));
jest.mock("../config", () => ({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

import {
  registerWebPushSubscription,
  unregisterWebPushSubscription,
} from "../web-push-subscriptions";

describe("web push subscription api", () => {
  const originalFetch = global.fetch;
  const subscription = {
    endpoint: "https://push.example/subscription-1",
    p256dh: "p".repeat(65),
    auth: "a".repeat(24),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetValidAccessToken.mockResolvedValue("access-token");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    } as Response);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("registers the current browser through the authenticated Edge Function", async () => {
    await registerWebPushSubscription("org-1", subscription);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://project.supabase.co/functions/v1/register-web-push",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
    const body = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1].body));
    expect(body).toEqual(expect.objectContaining({ action: "subscribe", organizationId: "org-1", ...subscription }));
  });

  test("unregisters the same endpoint", async () => {
    await unregisterWebPushSubscription("org-1", subscription);
    const body = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1].body));
    expect(body.action).toBe("unsubscribe");
    expect(body.endpoint).toBe(subscription.endpoint);
  });

  test("fails closed without an authenticated session", async () => {
    mockGetValidAccessToken.mockResolvedValue("");
    await expect(registerWebPushSubscription("org-1", subscription))
      .rejects.toThrow("Sessão inválida");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
