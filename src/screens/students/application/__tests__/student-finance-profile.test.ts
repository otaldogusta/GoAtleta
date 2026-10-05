import type { OrganizationInvoice } from "../../../../api/finance";
import { deriveStudentFinanceProfile, financeToneForInvoice, invoiceStatusForProfile, selectStudentInvoices } from "../student-finance-profile";

const invoice = (id: string, patch: Partial<OrganizationInvoice> = {}): OrganizationInvoice => ({
  id,
  studentId: "student-a",
  studentName: "Atleta",
  competenceMonth: "2026-10-01",
  dueDate: "2026-10-10",
  amountCents: 24000,
  paidCents: 0,
  status: "open",
  description: "Mensalidade",
  createdAt: "2026-10-01T12:00:00Z",
  paidAt: null,
  ...patch,
});

it("selects only invoices for the scoped student", () => {
  expect(selectStudentInvoices([
    invoice("own"),
    invoice("other", { studentId: "student-b" }),
  ], "student-a").map(item => item.id)).toEqual(["own"]);
});

it("prioritizes overdue invoices and keeps the payment total tied to the selected year", () => {
  const overdue = invoice("overdue", { dueDate: "2026-09-10", competenceMonth: "2026-09-01" });
  const paid = invoice("paid", { status: "paid", paidCents: 24000, paidAt: "2026-08-09T12:00:00Z", competenceMonth: "2026-08-01" });
  const result = deriveStudentFinanceProfile([invoice("upcoming"), paid, overdue], 2026, "2026-10-02");
  expect(result.highlight?.id).toBe("overdue");
  expect(result.overdueCount).toBe(1);
  expect(result.paidCents).toBe(24000);
  expect(result.history.map(item => item.id)).toEqual(["upcoming", "paid"]);
  expect(financeToneForInvoice(overdue, "2026-10-02")).toBe("danger");
  expect(invoiceStatusForProfile(overdue, "2026-10-02")).toBe("Vencido");
});

it("uses the latest paid invoice when nothing is open and handles an empty year", () => {
  const paid = invoice("paid", { status: "paid", paidCents: 24000, paidAt: "2026-09-09T12:00:00Z", competenceMonth: "2026-09-01" });
  expect(deriveStudentFinanceProfile([paid], 2026, "2026-10-02").highlight?.id).toBe("paid");
  expect(financeToneForInvoice(paid, "2026-10-02")).toBe("success");
  expect(deriveStudentFinanceProfile([paid], 2025, "2026-10-02").highlight).toBeNull();
});
