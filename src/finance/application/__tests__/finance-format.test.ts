import {
  canRecordManualPaymentForInvoice,
  formatFinanceDate,
  formatMoneyFromCents,
  getInvoiceOutstandingCents,
  invoiceStatusLabel,
  normalizeInvoiceStatus,
  parseMoneyInputToCents,
  toFinancePaidAtIso,
} from "../finance-format";

describe("finance formatting", () => {
  it("formats cents in BRL", () => {
    expect(formatMoneyFromCents(12990)).toContain("129,90");
  });

  it("formats date-only values without timezone drift", () => {
    expect(formatFinanceDate("2026-08-30")).toBe("30/08/2026");
  });

  it("uses a safe open status for unknown server values", () => {
    expect(normalizeInvoiceStatus("provider_custom")).toBe("open");
    expect(invoiceStatusLabel[normalizeInvoiceStatus("paid")]).toBe("Paga");
  });

  it("maps database status aliases into the canonical invoice contract", () => {
    expect(normalizeInvoiceStatus("pending")).toBe("awaiting_payment");
    expect(normalizeInvoiceStatus("void")).toBe("canceled");
  });

  it("parses Brazilian money input into integer cents", () => {
    expect(parseMoneyInputToCents("149,90")).toBe(14990);
    expect(parseMoneyInputToCents("1.249,50")).toBe(124950);
    expect(parseMoneyInputToCents("0")).toBeNull();
    expect(parseMoneyInputToCents("12,999")).toBeNull();
  });

  it("calculates the payable balance without falling back to the total", () => {
    expect(getInvoiceOutstandingCents(14990, 5000)).toBe(9990);
    expect(getInvoiceOutstandingCents(14990, 14990)).toBe(0);
    expect(getInvoiceOutstandingCents(14990, 20000)).toBe(0);
  });

  it("only allows manual payment for payable invoices with balance", () => {
    expect(
      canRecordManualPaymentForInvoice({
        amountCents: 14990,
        paidCents: 5000,
        status: "partially_paid",
      })
    ).toBe(true);
    expect(
      canRecordManualPaymentForInvoice({
        amountCents: 14990,
        paidCents: 14990,
        status: "paid",
      })
    ).toBe(false);
    expect(
      canRecordManualPaymentForInvoice({
        amountCents: 14990,
        paidCents: 0,
        status: "canceled",
      })
    ).toBe(false);
  });

  it("creates a valid paid-at timestamp from a date-only value", () => {
    expect(toFinancePaidAtIso("2026-08-30")).toContain("2026-08-30T");
    expect(toFinancePaidAtIso("2026-02-30")).toBeNull();
    expect(toFinancePaidAtIso("30/08/2026")).toBeNull();
  });
});
