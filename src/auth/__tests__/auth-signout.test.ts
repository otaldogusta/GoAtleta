import { revokeAuthSession } from "../auth-signout";

jest.mock("../../api/config", () => ({
  SUPABASE_URL: "https://project.supabase.co/",
  SUPABASE_ANON_KEY: "anon-key",
}));

describe("revokeAuthSession", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("revokes only the current Supabase session", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 204 });
    global.fetch = fetchMock as typeof fetch;

    await revokeAuthSession("old-access-token");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/logout?scope=local",
      expect.objectContaining({
        method: "POST",
        headers: {
          apikey: "anon-key",
          Authorization: "Bearer old-access-token",
        },
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("does not call Supabase when there is no active token", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    await revokeAuthSession("  ");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts an already invalidated session", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as typeof fetch;

    await expect(revokeAuthSession("expired-token")).resolves.toBeUndefined();
  });
});
