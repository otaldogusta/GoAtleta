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
  jest.doMock("react-native", () => ({
    Platform: { OS: os },
  }));
  return import("../session");
}

describe("session storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
