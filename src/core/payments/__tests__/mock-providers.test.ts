import {
  createMoney,
  MockPaymentsProvider,
  MockReceivablesProvider,
  REAL_MONEY_PAYMENTS_ENABLED,
  UnsafePaymentsConfigurationError,
} from "..";

const localConfig = {
  mode: "mock" as const,
  origin: "http://localhost:8081",
  webhookToken: "local-mock-token-only",
  allowRealMoney: false as const,
};

describe("localhost-only mock payment providers", () => {
  it("keeps real-money operations disabled", () => {
    expect(REAL_MONEY_PAYMENTS_ENABLED).toBe(false);
    expect(
      () =>
        new MockPaymentsProvider({
          ...localConfig,
          origin: "https://goatleta.com",
        }),
    ).toThrow(UnsafePaymentsConfigurationError);
    expect(
      () =>
        new MockPaymentsProvider({
          ...localConfig,
          allowRealMoney: true,
        } as never),
    ).toThrow("Real-money payments are disabled");
  });

  it("creates only local, non-live platform billing actions", async () => {
    const provider = new MockPaymentsProvider(localConfig);
    const checkout = await provider.createSubscriptionCheckout({
      organizationId: "org-1",
      customerId: "customer-1",
      planCode: "gestao-basico",
      successUrl: "http://localhost:8081/billing/success",
      cancelUrl: "http://localhost:8081/billing/cancel",
    });

    expect(checkout).toMatchObject({
      provider: "mock",
      livemode: false,
      realMoney: false,
      status: "incomplete",
    });
    expect(new URL(checkout.url).origin).toBe("http://localhost:8081");

    const canceled = await provider.cancelSubscription({
      organizationId: "org-1",
      subscriptionReference: checkout.subscriptionReference,
      cancelAtPeriodEnd: false,
    });
    expect(canceled.status).toBe("canceled");
  });

  it("creates organization-scoped mock receivables without network calls", async () => {
    const provider = new MockReceivablesProvider(localConfig);
    const merchant = await provider.createMerchantAccount({
      organizationId: "org-1",
      legalName: "Instituicao Teste",
      returnUrl: "http://localhost:8081/financeiro",
    });
    const customer = await provider.createCustomer({
      organizationId: "org-1",
      externalCustomerId: "responsible-1",
      name: "Responsavel Teste",
    });
    const charge = await provider.createCharge({
      organizationId: "org-1",
      merchantReference: merchant.merchantReference,
      customerReference: customer.customerReference,
      externalInvoiceId: "invoice-1",
      amount: createMoney(15000),
      dueAt: "2026-09-10T12:00:00.000Z",
      method: "pix",
      description: "Mensalidade de teste",
      returnUrl: "http://localhost:8081/financeiro/mensalidades",
    });

    expect(merchant).toMatchObject({
      status: "enabled",
      livemode: false,
      realMoney: false,
    });
    expect(charge).toMatchObject({
      status: "open",
      amount: { amountMinor: 15000, currency: "BRL" },
      livemode: false,
      realMoney: false,
    });
    expect(new URL(charge.hostedPaymentUrl ?? "").origin).toBe(
      "http://localhost:8081",
    );

    const canceled = await provider.cancelCharge({
      organizationId: "org-1",
      chargeReference: charge.chargeReference,
    });
    expect(canceled.status).toBe("canceled");
  });

  it("authenticates mock webhooks and rejects live payloads", async () => {
    const provider = new MockReceivablesProvider(localConfig);
    const request = {
      headers: {
        "X-GoAtleta-Mock-Webhook-Token": localConfig.webhookToken,
      },
      body: JSON.stringify({
        eventId: "event-1",
        eventType: "invoice.paid",
        occurredAt: "2026-08-30T12:00:00.000Z",
        subject: { type: "invoice", id: "invoice-1" },
        data: { status: "paid" },
      }),
      receivedAt: "2026-08-30T12:00:01.000Z",
    };

    await expect(provider.parseWebhook(request)).resolves.toMatchObject({
      eventId: "event-1",
      provider: "mock",
      livemode: false,
      realMoney: false,
    });

    await expect(
      provider.parseWebhook({
        ...request,
        headers: { "x-goatleta-mock-webhook-token": "wrong-token" },
      }),
    ).rejects.toThrow("authentication failed");

    await expect(
      provider.parseWebhook({
        ...request,
        body: JSON.stringify({
          eventId: "event-live",
          eventType: "payment.paid",
          occurredAt: "2026-08-30T12:00:00.000Z",
          subject: { type: "payment", id: "payment-1" },
          livemode: true,
        }),
      }),
    ).rejects.toThrow("cannot represent live");
  });
});
