import type { OrganizationInvoice } from "../../../../api/finance";
import type { AttendanceRecord } from "../../../../core/models";
import {
  deriveStudentAttendanceIndicator,
  deriveStudentFinanceIndicator,
  deriveStudentFinanceSummary,
} from "../student-operational-indicators";

const invoice = (
  overrides: Partial<OrganizationInvoice> = {},
): OrganizationInvoice => ({
  id: "invoice-1",
  studentId: "student-1",
  studentName: "Atleta Teste",
  competenceMonth: "2026-09",
  dueDate: "2026-09-10",
  amountCents: 16000,
  paidCents: 0,
  status: "open",
  description: "Mensalidade",
  createdAt: "2026-09-01T12:00:00.000Z",
  paidAt: null,
  ...overrides,
});

const attendance = (
  date: string,
  status: AttendanceRecord["status"],
  id = date,
): AttendanceRecord => ({
  id,
  classId: "class-1",
  studentId: "student-1",
  date,
  status,
  note: "",
  painScore: 0,
  createdAt: `${date}T12:00:00.000Z`,
});

describe("student operational indicators", () => {
  const now = new Date("2026-09-03T12:00:00");

  it("prioritizes an overdue finance state from the real invoice list", () => {
    expect(
      deriveStudentFinanceIndicator(
        [
          invoice({ id: "paid", status: "paid", paidCents: 16000 }),
          invoice({ id: "late", dueDate: "2026-09-01" }),
        ],
        now,
      ),
    ).toEqual({
      label: "Em atraso",
      detail: "1 cobrança vencida",
      tone: "danger",
    });
  });

  it("shows a settled or empty finance state without a manual selector", () => {
    expect(
      deriveStudentFinanceIndicator(
        [invoice({ status: "paid", paidCents: 16000 })],
        now,
      ).label,
    ).toBe("Em dia");
    expect(deriveStudentFinanceIndicator([], now).label).toBe("Sem cobrança");
  });

  it("summarizes outstanding balances without including canceled, refunded or draft invoices", () => {
    const invoices = [
      invoice({ id: "late", dueDate: "2026-09-01", paidCents: 6000, status: "partially_paid" }),
      invoice({ id: "next", dueDate: "2026-09-10", createdAt: "2026-09-02T12:00:00.000Z" }),
      invoice({ id: "later", dueDate: "2026-10-10" }),
      invoice({ id: "canceled", status: "canceled" }),
      invoice({ id: "draft", status: "draft" }),
      invoice({ id: "refunded", status: "refunded" }),
      invoice({ id: "paid", status: "paid", paidCents: 16000, paidAt: "2026-09-02T18:00:00.000Z" }),
    ];
    const originalOrder = invoices.map((item) => item.id);
    expect(deriveStudentFinanceSummary(invoices, now)).toMatchObject({
      outstandingCents: 42000,
      overdueCents: 10000,
      nextDueDate: "2026-09-10",
      latestInvoice: { id: "next" },
      lastPaidAt: "2026-09-02T18:00:00.000Z",
    });
    expect(invoices.map((item) => item.id)).toEqual(originalOrder);
  });

  it("uses the same overdue rule in the summary and badge, including disputes", () => {
    const invoices = [invoice({ status: "disputed", dueDate: "2026-10-01" })];
    expect(deriveStudentFinanceSummary(invoices, now)).toMatchObject({
      outstandingCents: 16000,
      overdueCents: 16000,
      nextDueDate: null,
    });
    expect(deriveStudentFinanceIndicator(invoices, now).label).toBe("Em atraso");
  });

  it("does not invent a due date or payment for an empty history", () => {
    expect(deriveStudentFinanceSummary([], now)).toEqual({
      outstandingCents: 0, overdueCents: 0, nextDueDate: null, latestInvoice: null, lastPaidAt: null,
    });
    expect(deriveStudentFinanceSummary([
      invoice({ status: "partially_paid", paidCents: 1000, paidAt: "2026-09-02" }),
      invoice({ status: "paid", paidCents: 16000, paidAt: "invalid" }),
    ], now).lastPaidAt).toBeNull();
  });

  it("raises a strong warning for three consecutive absences", () => {
    expect(
      deriveStudentAttendanceIndicator(
        [
          attendance("2026-09-03", "faltou"),
          attendance("2026-09-02", "faltou"),
          attendance("2026-09-01", "faltou"),
          attendance("2026-08-30", "presente"),
        ],
        now,
      ),
    ).toEqual({
      label: "Atenção",
      detail: "3 faltas seguidas",
      tone: "danger",
    });
  });

  it("warns about isolated recent absences and clears old alerts", () => {
    expect(
      deriveStudentAttendanceIndicator(
        [
          attendance("2026-09-03", "presente"),
          attendance("2026-08-28", "faltou"),
        ],
        now,
      ).label,
    ).toBe("Acompanhar");
    expect(
      deriveStudentAttendanceIndicator(
        [
          attendance("2026-09-03", "presente"),
          attendance("2026-07-01", "faltou"),
        ],
        now,
      ).label,
    ).toBe("Sem alerta");
  });
});
