import {
  asaasRequest,
  detectAsaasEnvironment,
  listAllAsaas,
  validateAsaasConnection,
} from "../asaas-client.ts";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Asaas API client", () => {
  test.each([
    ["$aact_hmlg_abcdefghijklmnopqrstuvwxyz", "sandbox"],
    ["$aact_prod_abcdefghijklmnopqrstuvwxyz", "production"],
  ] as const)(
    "detects a prefixed key as %s without an HTTP probe",
    async (apiKey, expectedEnvironment) => {
      const fetcher = jest.fn();

      await expect(
        detectAsaasEnvironment({
          apiKey,
          fetcher: fetcher as typeof fetch,
        }),
      ).resolves.toBe(expectedEnvironment);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  test("probes both read-only endpoints for a legacy key", async () => {
    const fetcher = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.asaas.com/")) {
        return Promise.resolve(
          jsonResponse(
            {
              errors: [
                {
                  code: "invalid_access_token",
                  description: "Invalid access token",
                },
              ],
            },
            401,
          ),
        );
      }
      return Promise.resolve(jsonResponse({ general: "ACTIVE" }));
    });

    await expect(
      detectAsaasEnvironment({
        apiKey: "legacy-key-with-more-than-twenty-characters",
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe("sandbox");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      "https://api.asaas.com/v3/myAccount/status/",
    );
    expect(String(fetcher.mock.calls[1]?.[0])).toBe(
      "https://api-sandbox.asaas.com/v3/myAccount/status/",
    );
  });

  test("sends the key only in the Asaas access_token header", async () => {
    const fetcher = jest.fn().mockResolvedValue(jsonResponse({ data: [] }));

    await asaasRequest({
      apiKey: "sandbox-key-with-more-than-twenty-characters",
      environment: "sandbox",
      pathname: "/customers?limit=1",
      fetcher: fetcher as typeof fetch,
    });

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/customers?limit=1");
    expect(init.headers).toMatchObject({
      access_token: "sandbox-key-with-more-than-twenty-characters",
      "User-Agent": "GoAtleta/1.0 (receivables-connector)",
    });
    expect(init.headers).not.toHaveProperty("Authorization");
    expect(url).not.toContain("sandbox-key");
  });

  test("validates the account and discovers existing record counts", async () => {
    const fetcher = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/myAccount/status/")) {
        return Promise.resolve(jsonResponse({ general: "ACTIVE" }));
      }
      if (url.includes("/wallets/")) {
        return Promise.resolve(jsonResponse([{ id: "wallet-123" }]));
      }
      if (url.includes("/customers")) {
        return Promise.resolve(jsonResponse({ totalCount: 18, data: [] }));
      }
      if (url.includes("/payments")) {
        return Promise.resolve(jsonResponse({ totalCount: 42, data: [] }));
      }
      return Promise.resolve(jsonResponse({ totalCount: 3, data: [] }));
    });

    await expect(
      validateAsaasConnection({
        apiKey: "production-key-with-more-than-twenty-characters",
        environment: "production",
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toEqual({
      walletId: "wallet-123",
      accountStatus: "ACTIVE",
      customerCount: 18,
      paymentCount: 42,
      subscriptionCount: 3,
    });
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  test("paginates imports but stops at the configured safety limit", async () => {
    const fetcher = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const offset = Number(new URL(url).searchParams.get("offset"));
      const data = Array.from({ length: 100 }, (_, index) => ({
        id: `customer-${offset + index}`,
      }));
      return Promise.resolve(
        jsonResponse({ totalCount: 350, hasMore: true, data }),
      );
    });

    await expect(
      listAllAsaas<{ id: string }>({
        apiKey: "sandbox-key-with-more-than-twenty-characters",
        environment: "sandbox",
        resource: "customers",
        maxPages: 2,
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toMatchObject({
      totalCount: 350,
      truncated: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
