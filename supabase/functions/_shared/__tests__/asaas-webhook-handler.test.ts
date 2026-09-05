import { createAsaasWebhookHandler, type AsaasWebhookDependencies } from "../asaas-webhook-handler.ts";

const scope = { organizationId: "org-1", connectionId: "production-account-1" };
const request = (id = "event-1", payment = { id: "pay-1", customer: "cus-1", status: "RECEIVED", value: 150 }) => new Request("https://example.test/webhook", {
  method: "POST",
  headers: { "asaas-access-token": "test-only-webhook-token-12345678901234567890" },
  body: JSON.stringify({ id, event: "PAYMENT_RECEIVED", payment }),
});
const dependencies = (): jest.Mocked<AsaasWebhookDependencies> => ({
  findScope: jest.fn().mockResolvedValue(scope),
  matchCustomer: jest.fn().mockResolvedValue("unmatched"),
  findInvoice: jest.fn().mockResolvedValue(null),
  processEvent: jest.fn().mockResolvedValue({ duplicate: false }),
});

describe("Asaas webhook delivery", () => {
  it("does not acknowledge a failed transaction and delegates redelivery again", async () => {
    const deps = dependencies();
    deps.processEvent.mockRejectedValueOnce(new Error("transient database failure"));
    const handler = createAsaasWebhookHandler(deps);
    expect((await handler(request())).status).toBe(503);
    expect((await handler(request())).status).toBe(200);
    expect(deps.processEvent).toHaveBeenCalledTimes(2);
    expect(deps.processEvent.mock.calls[1][0]).toEqual({
      ...deps.processEvent.mock.calls[0][0],
      p_payment: { ...deps.processEvent.mock.calls[0][0].p_payment, imported_at: expect.any(String) },
    });
  });

  it("uses the authenticated connection namespace for concurrent redeliveries", async () => {
    const deps = dependencies();
    deps.processEvent.mockResolvedValueOnce({ duplicate: false }).mockResolvedValueOnce({ duplicate: true });
    const handler = createAsaasWebhookHandler(deps);
    const deliveries = await Promise.all([handler(request()), handler(request())]);
    expect(deliveries.map((response) => response.status)).toEqual([200, 200]);
    expect(await deliveries[1].json()).toEqual({ received: true, duplicate: true });
    for (const [command] of deps.processEvent.mock.calls) {
      expect(command).toMatchObject({
        p_org_id: scope.organizationId,
        p_connection_id: scope.connectionId,
        p_payment: { connection_id: scope.connectionId, amount_cents: 15000 },
      });
    }
  });

  it("rejects unknown credentials without reading or writing financial records", async () => {
    const deps = dependencies();
    deps.findScope.mockResolvedValue(null);
    expect((await createAsaasWebhookHandler(deps)(request())).status).toBe(401);
    expect(deps.processEvent).not.toHaveBeenCalled();
    expect(deps.matchCustomer).not.toHaveBeenCalled();
  });

  it("keeps a transient matching failure retryable instead of saving a false unmatched record", async () => {
    const deps = dependencies();
    deps.matchCustomer.mockRejectedValueOnce(new Error("database unavailable"));
    const handler = createAsaasWebhookHandler(deps);
    expect((await handler(request())).status).toBe(503);
    expect(deps.processEvent).not.toHaveBeenCalled();
    expect((await handler(request())).status).toBe(200);
  });
});
