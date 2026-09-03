import type { OrganizationProviderReceivable } from "../../../api/finance";
import {
  getProviderReceivableBillingLabel,
  getProviderReceivableDisplayDate,
  getProviderReceivableMatchLabel,
  getProviderReceivableStatusLabel,
  summarizeProviderReceivables,
} from "../provider-receivables";

const receivable = (
  overrides: Partial<OrganizationProviderReceivable>,
): OrganizationProviderReceivable => ({
  id: "payment-1",
  customerName: "Cliente Asaas",
  providerStatus: "RECEIVED",
  billingType: "BOLETO",
  amountCents: 1000,
  netAmountCents: 901,
  dueDate: "2026-09-15",
  paidAt: "2026-09-02T12:00:00Z",
  matchStatus: "matched",
  invoiceId: null,
  importedAt: "2026-09-02T12:01:00Z",
  ...overrides,
});

describe("provider receivables", () => {
  it("summarizes only settled provider amounts as received", () => {
    const summary = summarizeProviderReceivables([
      receivable({}),
      receivable({
        id: "payment-2",
        providerStatus: "DUNNING_RECEIVED",
        amountCents: 2000,
        netAmountCents: 1800,
        matchStatus: "unmatched",
      }),
      receivable({
        id: "payment-3",
        providerStatus: "PENDING",
        amountCents: 5000,
        netAmountCents: 5000,
      }),
    ]);

    expect(summary).toEqual({
      totalCount: 3,
      receivedCount: 2,
      receivedGrossCents: 3000,
      receivedNetCents: 2701,
      identifiedCustomerCount: 2,
      reconciliationCount: 1,
    });
  });

  it("formats provider metadata without exposing provider identifiers", () => {
    expect(getProviderReceivableStatusLabel("RECEIVED")).toBe("Recebida");
    expect(getProviderReceivableBillingLabel("BOLETO")).toBe("Boleto");
    expect(getProviderReceivableMatchLabel("unmatched")).toBe("A conciliar");
    expect(getProviderReceivableDisplayDate(receivable({}))).toBe("2026-09-02");
  });
});
