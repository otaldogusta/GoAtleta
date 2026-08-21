type SessionModule = typeof import("../session");

const asyncStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

const secureStoreMock = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: "WHEN_UNLOCKED",
};

async function loadSessionModuleFor(os: "ios" | "android" | "web"): Promise<SessionModule> {
  jest.resetModules();
  jest.doMock("@react-native-async-storage/async-storage", () => asyncStorageMock);
  jest.doMock("expo-secure-store", () => secureStoreMock);
  jest.doMock("../../api/config", () => ({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
  }));
  jest.doMock("react-native", () => ({
    Platform: { OS: os },
  }));
  return require("../session") as SessionModule;
}

describe("session storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("native loads session from SecureStore", async () => {
    const mod = await loadSessionModuleFor("ios");
    asyncStorageMock.getItem.mockResolvedValue("true");
    secureStoreMock.getItemAsync.mockResolvedValue(
      JSON.stringify({
        access_token: "a",
        refresh_token: "r",
        expires_at: 999999,
        user: { id: "u1", email: "u@x.com" },
      })
    );

    const session = await mod.loadSession();
    expect(session?.access_token).toBe("a");
    expect(secureStoreMock.getItemAsync).toHaveBeenCalled();
  });

  test("native migrates legacy AsyncStorage session into SecureStore", async () => {
    const mod = await loadSessionModuleFor("android");
    asyncStorageMock.getItem
      .mockResolvedValueOnce("true")
      .mockResolvedValueOnce(
        JSON.stringify({
          access_token: "legacy-a",
          refresh_token: "legacy-r",
          expires_at: 999999,
          user: { id: "u2", email: "u2@x.com" },
        })
      );
    secureStoreMock.getItemAsync.mockResolvedValue(null);

    const session = await mod.loadSession();
    expect(session?.access_token).toBe("legacy-a");
    expect(secureStoreMock.setItemAsync).toHaveBeenCalled();
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith("auth_session_v1");
  });

  test("remember false does not persist session", async () => {
    const mod = await loadSessionModuleFor("ios");
    await mod.saveSession(
      {
        access_token: "a",
        refresh_token: "r",
        expires_at: 999999,
        user: { id: "u3", email: "u3@x.com" },
      },
      false
    );

    expect(asyncStorageMock.setItem).toHaveBeenCalledWith("auth_remember_me", "false");
    expect(secureStoreMock.deleteItemAsync).toHaveBeenCalledWith("auth_session_v1");
    expect(secureStoreMock.setItemAsync).not.toHaveBeenCalled();
  });

  test("web persists session even when remember is false", async () => {
    const mod = await loadSessionModuleFor("web");
    const payload = {
      access_token: "web-a",
      refresh_token: "web-r",
      expires_at: 999999,
      user: { id: "u-web", email: "u-web@x.com" },
    };

    await mod.saveSession(payload, false);

    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      "auth_session_v1",
      JSON.stringify(payload)
    );

    asyncStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "auth_remember_me") return Promise.resolve("false");
      if (key === "auth_session_v1") return Promise.resolve(JSON.stringify(payload));
      return Promise.resolve(null);
    });

    const session = await mod.loadSession();
    expect(session?.access_token).toBe("web-a");
  });

  test("hasStoredSession returns true when secure store has payload", async () => {
    const mod = await loadSessionModuleFor("ios");
    asyncStorageMock.getItem.mockResolvedValue("true");
    secureStoreMock.getItemAsync.mockResolvedValue('{"access_token":"a"}');

    await expect(mod.hasStoredSession()).resolves.toBe(true);
  });

  test("hasStoredSession returns false on web", async () => {
    const mod = await loadSessionModuleFor("web");
    await expect(mod.hasStoredSession()).resolves.toBe(false);
  });

  test("native starts signed out when a restored SecureStore payload is unreadable", async () => {
    const mod = await loadSessionModuleFor("android");
    asyncStorageMock.getItem.mockResolvedValue("true");
    secureStoreMock.getItemAsync.mockRejectedValue(
      new Error("Could not decrypt the item in SecureStore")
    );
    secureStoreMock.deleteItemAsync.mockRejectedValue(
      new Error("Keystore key is unavailable")
    );

    await expect(mod.loadSession()).resolves.toBeNull();
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith("auth_session_v1");
  });

  test("native keeps a valid legacy session when SecureStore migration fails", async () => {
    const mod = await loadSessionModuleFor("android");
    const legacySession = {
      access_token: "legacy-a",
      refresh_token: "legacy-r",
      expires_at: 999999,
      user: { id: "u4", email: "u4@x.com" },
    };
    asyncStorageMock.getItem
      .mockResolvedValueOnce("true")
      .mockResolvedValueOnce(JSON.stringify(legacySession));
    secureStoreMock.getItemAsync.mockResolvedValue(null);
    secureStoreMock.setItemAsync.mockRejectedValue(new Error("SecureStore unavailable"));

    await expect(mod.loadSession()).resolves.toEqual(legacySession);
    expect(asyncStorageMock.removeItem).not.toHaveBeenCalledWith("auth_session_v1");
  });

  test("clears a deleted user's stored web session before route guards run", async () => {
    const mod = await loadSessionModuleFor("web");
    const staleSession = {
      access_token: "stale-access",
      refresh_token: "stale-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "deleted-user", email: "deleted@x.com" },
    };
    asyncStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "auth_session_v1") return Promise.resolve(JSON.stringify(staleSession));
      if (key === "auth_remember_me") return Promise.resolve("true");
      return Promise.resolve(null);
    });
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    await expect(mod.loadValidatedSession()).resolves.toBeNull();
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith("auth_session_v1");
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith("auth_remember_me");
  });

  test("clears an expired deleted-user session when its refresh token is gone", async () => {
    const mod = await loadSessionModuleFor("web");
    const staleSession = {
      access_token: "expired-access",
      refresh_token: "deleted-refresh",
      expires_at: Math.floor(Date.now() / 1000) - 60,
      user: { id: "deleted-user", email: "deleted@x.com" },
    };
    asyncStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "auth_session_v1") return Promise.resolve(JSON.stringify(staleSession));
      if (key === "auth_remember_me") return Promise.resolve("true");
      return Promise.resolve(null);
    });
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error_code: "refresh_token_not_found" }),
    } as Response);

    await expect(mod.loadValidatedSession()).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith("auth_session_v1");
  });

  test("keeps a valid stored web session and refreshes its user payload", async () => {
    const mod = await loadSessionModuleFor("web");
    const storedSession = {
      access_token: "valid-access",
      refresh_token: "valid-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "live-user", email: "old@x.com" },
    };
    asyncStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "auth_session_v1") return Promise.resolve(JSON.stringify(storedSession));
      if (key === "auth_remember_me") return Promise.resolve("true");
      return Promise.resolve(null);
    });
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "live-user", email: "current@x.com" }),
    } as Response);

    await expect(mod.loadValidatedSession()).resolves.toMatchObject({
      access_token: "valid-access",
      user: { id: "live-user", email: "current@x.com" },
    });
  });

  test("preserves a cached session during a transient user endpoint failure", async () => {
    const mod = await loadSessionModuleFor("web");
    const storedSession = {
      access_token: "valid-access",
      refresh_token: "valid-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "live-user", email: "live@x.com" },
    };
    asyncStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "auth_session_v1") return Promise.resolve(JSON.stringify(storedSession));
      if (key === "auth_remember_me") return Promise.resolve("true");
      return Promise.resolve(null);
    });
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    await expect(mod.loadValidatedSession()).resolves.toMatchObject(storedSession);
    expect(asyncStorageMock.removeItem).not.toHaveBeenCalledWith("auth_session_v1");
  });
});
