import type { OrganizationInvoice } from "../../../api/finance";
import { summarizeFinanceInvoices } from "../finance-summary";

const invoice = (
  id: string,
  status: OrganizationInvoice["status"],
  amountCents = 16000,
  paidCents = 0,
): OrganizationInvoice => ({
  id,
  studentId: `student-${id}`,
  studentName: `Atleta ${id}`,
  competenceMonth: "2026-09-01",
  dueDate: "2026-09-10",
  amountCents,
  paidCents,
  status,
  description: "Mensalidade",
  createdAt: "2026-09-01T12:00:00.000Z",
  paidAt: status === "paid" ? "2026-09-10T12:00:00.000Z" : null,
});

describe("finance summary", () => {
  it("keeps open and overdue amounts mutually exclusive", () => {
    const summary = summarizeFinanceInvoices(
      [
        invoice("open", "open"),
        invoice("partial", "partially_paid", 16000, 4000),
        invoice("overdue", "overdue"),
        invoice("paid", "paid", 16000, 16000),
      ],
      "org-1",
      4,
    );

    expect(summary).toMatchObject({
      organizationId: "org-1",
      expectedCents: 64000,
      receivedCents: 20000,
      openCents: 28000,
      overdueCents: 16000,
      openCount: 2,
      overdueCount: 1,
      paidCount: 1,
      activeAgreementsCount: 4,
    });
  });

  it("excludes non-billable invoices", () => {
    const summary = summarizeFinanceInvoices(
      [
        invoice("draft", "draft"),
        invoice("canceled", "canceled"),
        invoice("refunded", "refunded"),
      ],
      "org-1",
    );

    expect(summary.expectedCents).toBe(0);
    expect(summary.openCount).toBe(0);
    expect(summary.overdueCount).toBe(0);
  });
});
