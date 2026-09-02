import {
  getFinanceProviderDemoStatus,
  runFinanceProviderDemoAction,
  startFinanceProviderDemo,
  stopFinanceProviderDemo,
} from "../finance-provider-demo";

describe("finance provider local demo", () => {
  const organizationId = "org-demo";

  afterEach(async () => {
    if (getFinanceProviderDemoStatus(organizationId)) {
      await stopFinanceProviderDemo(organizationId, true);
    }
  });

  it("starts read-only without enabling real charges", async () => {
    const status = await startFinanceProviderDemo(organizationId, true);

    expect(status).toMatchObject({
      status: "connected",
      canManageConnection: true,
      connection: {
        environment: "sandbox",
        mode: "read_only",
        keyHint: "••••DEMO",
        webhookStatus: "not_configured",
        chargesEnabled: false,
        sync: null,
      },
    });
  });

  it("simulates history and webhook transitions per organization", async () => {
    await startFinanceProviderDemo(organizationId, true);

    const synchronized = await runFinanceProviderDemoAction(
      organizationId,
      "sync",
    );
    expect(synchronized.connection?.sync).toMatchObject({
      customerCount: 36,
      matchedCustomerCount: 31,
      ambiguousCustomerCount: 2,
      paymentCount: 84,
      subscriptionCount: 28,
    });

    const updated = await runFinanceProviderDemoAction(
      organizationId,
      "webhook",
    );
    expect(updated.connection?.webhookStatus).toBe("configured");
    expect(getFinanceProviderDemoStatus("another-org")).toBeNull();
  });

  it("removes only the local simulation", async () => {
    await startFinanceProviderDemo(organizationId, true);
    const status = await stopFinanceProviderDemo(organizationId, true);

    expect(status.status).toBe("not_connected");
    expect(status.connection).toBeNull();
    expect(getFinanceProviderDemoStatus(organizationId)).toBeNull();
  });
});
