const mockAddBreadcrumb = jest.fn();
const mockCaptureException = jest.fn();
const mockInitDb = jest.fn();
const mockFlushPendingWrites = jest.fn();
const mockLoadPedagogicalConfig = jest.fn();
const mockSmartSyncInit = jest.fn();
const mockLoadSession = jest.fn();

jest.mock("@sentry/react-native", () => ({
  addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock("../../db/sqlite", () => ({
  initDb: () => mockInitDb(),
}));

jest.mock("../../db/seed", () => ({
  flushPendingWrites: () => mockFlushPendingWrites(),
}));

jest.mock("../../core/smart-sync", () => ({
  smartSync: {
    init: () => mockSmartSyncInit(),
  },
}));

jest.mock("../pedagogical-config-loader", () => ({
  loadPedagogicalConfig: () => mockLoadPedagogicalConfig(),
}));

jest.mock("../../auth/session", () => ({
  loadSession: () => mockLoadSession(),
}));

describe("bootstrapApp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitDb.mockResolvedValue(undefined);
    mockFlushPendingWrites.mockResolvedValue(undefined);
    mockLoadPedagogicalConfig.mockResolvedValue({
      config: { dimensions: [] },
      error: null,
    });
    mockLoadSession.mockResolvedValue({
      access_token: "token",
      refresh_token: "refresh",
      expires_at: 999999,
      user: { id: "user-1", email: "user@example.com" },
    });
  });

  test("returns persisted session from bootstrap", async () => {
    const { bootstrapApp } = require("../bootstrap") as typeof import("../bootstrap");

    const result = await bootstrapApp();

    expect(mockLoadSession).toHaveBeenCalledTimes(1);
    expect(result.session).toEqual({
      access_token: "token",
      refresh_token: "refresh",
      expires_at: 999999,
      user: { id: "user-1", email: "user@example.com" },
    });
    expect(mockInitDb).toHaveBeenCalledTimes(1);
    expect(mockLoadPedagogicalConfig).toHaveBeenCalledTimes(1);
  });
});
