import {
  mapAsaasCustomerRecord,
  mapAsaasPaymentRecord,
  maskProviderEmail,
  matchStatusForCount,
  moneyToCents,
  providerEmailCandidates,
} from "../asaas-sync.ts";

describe("Asaas read-only reconciliation helpers", () => {
  test("normalizes money without losing cents", () => {
    expect(moneyToCents(150.37)).toBe(15037);
    expect(moneyToCents("0.10")).toBe(10);
    expect(moneyToCents(-1)).toBe(0);
  });

  test("uses exact normalized emails and masks stored contact data", () => {
    expect(
      providerEmailCandidates({
        email: " Responsavel@Example.com ",
        additionalEmails:
          "outro@example.com, responsavel@example.com, invalido",
      }),
    ).toEqual(["responsavel@example.com", "outro@example.com"]);
    expect(maskProviderEmail("responsavel@example.com")).toBe(
      "re********@example.com",
    );
  });

  test("keeps ambiguous and unmatched provider customers out of automatic links", () => {
    expect(matchStatusForCount(0)).toBe("unmatched");
    expect(matchStatusForCount(1)).toBe("matched");
    expect(matchStatusForCount(2)).toBe("ambiguous");
  });

  test("maps imported records without raw document or contact details", () => {
    const customer = mapAsaasCustomerRecord({
      organizationId: "org-1",
      matchStatus: "matched",
      customer: {
        id: "cus-1",
        name: "Responsável",
        email: "responsavel@example.com",
        cpfCnpj: "123.456.789-01",
      },
    });
    const payment = mapAsaasPaymentRecord({
      organizationId: "org-1",
      matchStatus: "matched",
      payment: {
        id: "pay-1",
        customer: "cus-1",
        status: "RECEIVED",
        billingType: "PIX",
        value: 150,
        netValue: 148.5,
        dueDate: "2026-09-10",
        paymentDate: "2026-09-09",
      },
    });

    expect(customer).toMatchObject({
      email_masked: "re********@example.com",
      document_last4: "8901",
    });
    expect(customer).not.toHaveProperty("cpf_cnpj");
    expect(payment).toMatchObject({
      amount_cents: 15000,
      net_amount_cents: 14850,
      provider_status: "RECEIVED",
      paid_at: "2026-09-09T12:00:00.000Z",
    });
  });
});
