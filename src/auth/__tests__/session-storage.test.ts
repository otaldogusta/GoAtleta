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
    asyncStorageMock.getItem.mockReset();
    asyncStorageMock.setItem.mockReset();
    asyncStorageMock.removeItem.mockReset();
    secureStoreMock.getItemAsync.mockReset();
    secureStoreMock.setItemAsync.mockReset();
    secureStoreMock.deleteItemAsync.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("native loads session from SecureStore", async () => {
    const mod = await loadSessionModuleFor("ios");
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

  test("native persists session even when a legacy remember flag is false", async () => {
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

    expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith(
      "auth_session_v1",
      expect.any(String),
      { keychainAccessible: "WHEN_UNLOCKED" },
    );
    expect(secureStoreMock.deleteItemAsync).not.toHaveBeenCalled();
    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith("auth_remember_me");
  });

  test("web persists session independently of the email preference", async () => {
    const mod = await loadSessionModuleFor("web");
    const payload = {
      access_token: "web-a",
      refresh_token: "web-r",
      expires_at: 999999,
      user: { id: "u-web", email: "u-web@x.com" },
    };

    await mod.saveSession(payload);

    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      "auth_session_v1",
      JSON.stringify(payload)
    );

    asyncStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "auth_session_v1") return Promise.resolve(JSON.stringify(payload));
      return Promise.resolve(null);
    });

    const session = await mod.loadSession();
    expect(session?.access_token).toBe("web-a");
  });

  test("hasStoredSession returns true when secure store has payload", async () => {
    const mod = await loadSessionModuleFor("ios");
    secureStoreMock.getItemAsync.mockResolvedValue('{"access_token":"a"}');

    await expect(mod.hasStoredSession()).resolves.toBe(true);
  });

  test("hasStoredSession returns false on web", async () => {
    const mod = await loadSessionModuleFor("web");
    await expect(mod.hasStoredSession()).resolves.toBe(false);
  });

  test("native starts signed out when a restored SecureStore payload is unreadable", async () => {
    const mod = await loadSessionModuleFor("android");
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
      return Promise.resolve(null);
    });
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    await expect(mod.loadValidatedSession()).resolves.toMatchObject(storedSession);
    expect(asyncStorageMock.removeItem).not.toHaveBeenCalledWith("auth_session_v1");
  });

  test("bounds user validation time and falls back to the cached session", async () => {
    jest.useFakeTimers();
    const mod = await loadSessionModuleFor("web");
    const storedSession = {
      access_token: "valid-access",
      refresh_token: "valid-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "offline-user", email: "offline@x.com" },
    };
    asyncStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "auth_session_v1") return Promise.resolve(JSON.stringify(storedSession));
      return Promise.resolve(null);
    });
    jest.spyOn(global, "fetch").mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }) as Promise<Response>,
    );

    const validation = mod.loadValidatedSession();
    await jest.advanceTimersByTimeAsync(mod.AUTH_REQUEST_TIMEOUT_MS);

    await expect(validation).resolves.toEqual(storedSession);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test.each([429, 500, 503])(
    "preserves an expired session when refresh returns transient status %s",
    async (status) => {
      const mod = await loadSessionModuleFor("android");
      const storedSession = {
        access_token: "expired-access",
        refresh_token: "retry-refresh",
        expires_at: Math.floor(Date.now() / 1000) - 60,
        user: { id: "offline-user", email: "offline@x.com" },
      };
      secureStoreMock.getItemAsync.mockResolvedValue(JSON.stringify(storedSession));
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status,
        text: async () => JSON.stringify({ error: "temporary" }),
      } as Response);

      await expect(mod.loadValidatedSession()).resolves.toEqual(storedSession);
      expect(secureStoreMock.deleteItemAsync).not.toHaveBeenCalledWith("auth_session_v1");
      expect(global.fetch).toHaveBeenCalledTimes(1);
    },
  );

  test("preserves an expired session when refresh cannot reach the network", async () => {
    const mod = await loadSessionModuleFor("android");
    const storedSession = {
      access_token: "expired-access",
      refresh_token: "offline-refresh",
      expires_at: Math.floor(Date.now() / 1000) - 60,
      user: { id: "offline-user", email: "offline@x.com" },
    };
    secureStoreMock.getItemAsync.mockResolvedValue(JSON.stringify(storedSession));
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network request failed"));

    await expect(mod.loadValidatedSession()).resolves.toEqual(storedSession);
    expect(secureStoreMock.deleteItemAsync).not.toHaveBeenCalledWith("auth_session_v1");
  });
});
