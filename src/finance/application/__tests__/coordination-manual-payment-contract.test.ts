import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const receivablesSource = readFileSync(
  resolve(process.cwd(), "src/screens/finance/CoordinationReceivables.tsx"),
  "utf8",
);
const dashboardSource = readFileSync(
  resolve(
    process.cwd(),
    "src/screens/finance/CoordinationFinanceDashboard.tsx",
  ),
  "utf8",
);

describe("coordination manual payment contract", () => {
  it("collects and confirms the complete manual payment payload", () => {
    expect(receivablesSource).toContain("recordManualPayment({");
    expect(receivablesSource).toContain("amountCents: parsedAmount");
    expect(receivablesSource).toContain("method,");
    expect(receivablesSource).toContain("paidAt,");
    expect(receivablesSource).toContain("notes,");
    expect(receivablesSource).toContain("confirmed &&");
    expect(receivablesSource).toContain(
      "Confirmo que este valor já foi recebido",
    );
  });

  it("keeps one idempotency key for an identical retry and reloads after success", () => {
    expect(receivablesSource).toContain(
      "submissionRef.current?.fingerprint !== payloadFingerprint",
    );
    expect(receivablesSource).toContain(
      "idempotencyKey: submissionRef.current.idempotencyKey",
    );
    expect(receivablesSource).toContain("await load();");
    expect(receivablesSource).toContain("<ConfirmCloseOverlay");
  });

  it("requires financial permission and exposes the same action in both views", () => {
    expect(receivablesSource).toContain("memberPermissions.financial === true");
    expect(receivablesSource).toContain("<ManualPaymentModal");
    expect(dashboardSource).toContain("<ManualPaymentModal");
    expect(dashboardSource).toContain("onRecord={setPaymentInvoice}");
  });

  it("shows outstanding balance and names the KPI as open", () => {
    expect(receivablesSource).toContain("getInvoiceOutstandingCents(");
    expect(dashboardSource).toContain("getInvoiceOutstandingCents(");
    expect(dashboardSource).not.toContain(
      "outstandingCents || invoice.amountCents",
    );
    expect(dashboardSource).toContain('label: "Em aberto"');
    expect(dashboardSource).not.toContain('label: "A vencer"');
  });

  it("refreshes the selected invoice instead of keeping stale payment details", () => {
    expect(dashboardSource).toMatch(
      /filteredInvoices\.find\(\s*\(invoice\) => invoice\.id === detailInvoice\.id/,
    );
    expect(dashboardSource).not.toContain(
      "filteredInvoices.some((invoice) => invoice.id === detailInvoice.id)",
    );
    expect(receivablesSource).toContain(
      "next.find((invoice) => invoice.id === current.id)",
    );
  });
});
