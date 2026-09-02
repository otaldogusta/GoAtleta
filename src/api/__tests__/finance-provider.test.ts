import {
  connectFinanceProvider,
  disconnectFinanceProvider,
  getFinanceProviderConnection,
  provisionFinanceProviderWebhook,
  rotateFinanceProviderKey,
  syncFinanceProviderHistory,
} from "../finance-provider";
import {
  forceRefreshAccessToken,
  getValidAccessToken,
} from "../../auth/session";

jest.mock("../../auth/session", () => ({
  getValidAccessToken: jest.fn(),
  forceRefreshAccessToken: jest.fn(),
}));

const tokenMock = getValidAccessToken as jest.MockedFunction<
  typeof getValidAccessToken
>;
const refreshMock = forceRefreshAccessToken as jest.MockedFunction<
  typeof forceRefreshAccessToken
>;

const mockResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

describe("finance provider API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenMock.mockResolvedValue("access-token");
    refreshMock.mockResolvedValue(null);
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        status: "not_connected",
        canManageConnection: true,
        connection: null,
      }),
    ) as jest.Mock;
  });

  it("sends the API key only to the authenticated connect action", async () => {
    await connectFinanceProvider({
      organizationId: "org-1",
      apiKey: "$aact_test_secret",
    });
    const [, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(request.headers).toMatchObject({
      Authorization: "Bearer access-token",
    });
    expect(JSON.parse(String(request.body))).toEqual({
      action: "connect",
      organizationId: "org-1",
      apiKey: "$aact_test_secret",
    });
  });

  it("sends a replacement key only to the authenticated rotation action", async () => {
    await rotateFinanceProviderKey({
      organizationId: "org-1",
      apiKey: "$aact_test_replacement",
    });
    const [, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(request.headers).toMatchObject({
      Authorization: "Bearer access-token",
    });
    expect(JSON.parse(String(request.body))).toEqual({
      action: "rotate_key",
      organizationId: "org-1",
      apiKey: "$aact_test_replacement",
    });
  });

  it("never includes a credential in status, sync, webhook or disconnect calls", async () => {
    await getFinanceProviderConnection("org-1");
    await syncFinanceProviderHistory("org-1");
    await provisionFinanceProviderWebhook("org-1");
    await disconnectFinanceProvider("org-1");

    const bodies = (global.fetch as jest.Mock).mock.calls.map(([, request]) =>
      JSON.parse(String((request as RequestInit).body)),
    );
    expect(bodies.map((body) => body.action)).toEqual([
      "status",
      "sync",
      "provision_webhook",
      "disconnect",
    ]);
    expect(bodies.every((body) => body.apiKey === undefined)).toBe(true);
  });

  it("retries once with a refreshed user token", async () => {
    refreshMock.mockResolvedValue("refreshed-token");
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(mockResponse({ error: "expired" }, 401))
      .mockResolvedValueOnce(
        mockResponse({
          status: "not_connected",
          canManageConnection: true,
          connection: null,
        }),
      ) as jest.Mock;

    await getFinanceProviderConnection("org-1");

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[1][1].headers).toMatchObject({
      Authorization: "Bearer refreshed-token",
    });
  });
});
