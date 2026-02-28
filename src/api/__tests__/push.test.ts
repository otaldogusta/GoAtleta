/* eslint-disable import/first */
const mockGetValidAccessToken = jest.fn();

jest.mock("../../auth/session", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}));

jest.mock("../config", () => ({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

import { sendPushToUser } from "../push";

describe("push api", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("sendPushToUser returns normalized result on success", async () => {
    mockGetValidAccessToken.mockResolvedValue("token-1");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: "ok",
          sent: 1,
          failed: 0,
          invalidTokens: 0,
        }),
    } as Response);

    const result = await sendPushToUser({
      organizationId: "org_1",
      targetUserId: "user_2",
      title: "Chamada pendente",
      body: "Teste",
      data: { route: "/class/[id]/attendance", params: { id: "c1", date: "2026-02-26" } },
    });

    expect(result).toEqual({
      status: "ok",
      sent: 1,
      failed: 0,
      invalidTokens: 0,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://project.supabase.co/functions/v1/send-push",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          apikey: "anon-key",
        }),
      })
    );
  });

  test("sendPushToUser fails when session token is missing", async () => {
    mockGetValidAccessToken.mockResolvedValue("");

    await expect(
      sendPushToUser({
        organizationId: "org_1",
        targetUserId: "user_2",
        title: "A",
        body: "B",
      })
    ).rejects.toThrow("Sessão inválida. Faça login novamente.");
  });

  test("sendPushToUser surfaces function error payload", async () => {
    mockGetValidAccessToken.mockResolvedValue("token-1");
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: "Forbidden" }),
    } as Response);

    await expect(
      sendPushToUser({
        organizationId: "org_1",
        targetUserId: "user_2",
        title: "A",
        body: "B",
      })
    ).rejects.toThrow("Forbidden");
  });
});

