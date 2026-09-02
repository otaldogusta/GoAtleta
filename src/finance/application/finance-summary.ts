import type {
  OrganizationFinanceSummary,
  OrganizationInvoice,
} from "../../api/finance";
import {
  getInvoiceOutstandingCents,
  type InvoiceStatus,
} from "./finance-format";

const OPEN_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  "open",
  "awaiting_payment",
  "partially_paid",
];

export const summarizeFinanceInvoices = (
  invoices: OrganizationInvoice[],
  organizationId: string,
  activeAgreementsCount = 0,
): OrganizationFinanceSummary => {
  const billable = invoices.filter(
    (invoice) => !["draft", "canceled", "refunded"].includes(invoice.status),
  );

  return billable.reduce<OrganizationFinanceSummary>(
    (summary, invoice) => {
      const outstanding = getInvoiceOutstandingCents(
        invoice.amountCents,
        invoice.paidCents,
      );
      summary.expectedCents += invoice.amountCents;
      summary.receivedCents += invoice.paidCents;
      if (invoice.status === "overdue") {
        summary.overdueCents += outstanding;
        summary.overdueCount += 1;
      } else if (OPEN_INVOICE_STATUSES.includes(invoice.status)) {
        summary.openCents += outstanding;
        summary.openCount += 1;
      }
      if (invoice.status === "paid") summary.paidCount += 1;
      return summary;
    },
    {
      organizationId,
      expectedCents: 0,
      receivedCents: 0,
      overdueCents: 0,
      openCents: 0,
      overdueCount: 0,
      openCount: 0,
      paidCount: 0,
      activeAgreementsCount,
    },
  );
};
