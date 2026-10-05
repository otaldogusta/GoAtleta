import type { OrganizationInvoice } from "../../../api/finance";
import { getInvoiceOutstandingCents } from "../../../finance/application/finance-format";

export type FinanceTone = "warning" | "danger" | "success" | "neutral";

export const selectStudentInvoices = (invoices: OrganizationInvoice[], studentId: string) =>
  invoices.filter(invoice => invoice.studentId === studentId);

const payableStatuses = new Set<OrganizationInvoice["status"]>([
  "open", "awaiting_payment", "partially_paid", "overdue", "disputed",
]);

const dateOnly = (value: string) => value.slice(0, 10);
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const isOverdue = (invoice: OrganizationInvoice, today: string) =>
  invoice.status === "overdue" ||
  invoice.status === "disputed" ||
  (payableStatuses.has(invoice.status) && dateOnly(invoice.dueDate) < today);

export const financeToneForInvoice = (
  invoice: OrganizationInvoice,
  today = localToday(),
): FinanceTone => {
  if (invoice.status === "paid") return "success";
  if (isOverdue(invoice, today) && getInvoiceOutstandingCents(invoice.amountCents, invoice.paidCents) > 0) return "danger";
  if (payableStatuses.has(invoice.status)) return "warning";
  return "neutral";
};

export const invoiceStatusForProfile = (
  invoice: OrganizationInvoice,
  today = localToday(),
) => {
  const tone = financeToneForInvoice(invoice, today);
  if (invoice.status === "disputed") return "Em contestação";
  if (tone === "danger") return "Vencido";
  if (tone === "success") return "Pago";
  if (invoice.status === "partially_paid") return "Parcial";
  if (tone === "warning") return "A vencer";
  if (invoice.status === "canceled") return "Cancelado";
  if (invoice.status === "refunded" || invoice.status === "partially_refunded") return "Estornado";
  return "Rascunho";
};

export function deriveStudentFinanceProfile(
  invoices: OrganizationInvoice[],
  year: number,
  today = localToday(),
) {
  const years = [...new Set(invoices.map(invoice => Number(invoice.competenceMonth.slice(0, 4))))]
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const visible = invoices
    .filter(invoice => Number(invoice.competenceMonth.slice(0, 4)) === year)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const open = visible
    .filter(invoice => payableStatuses.has(invoice.status) && getInvoiceOutstandingCents(invoice.amountCents, invoice.paidCents) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const highlight = open.find(invoice => isOverdue(invoice, today)) ??
    open[0] ??
    visible.find(invoice => invoice.status === "paid") ??
    visible[0] ??
    null;
  const overdueCount = open.filter(invoice => isOverdue(invoice, today)).length;
  const paidCents = invoices
    .filter(invoice => invoice.status === "paid" && invoice.paidAt?.startsWith(String(year)))
    .reduce((total, invoice) => total + invoice.paidCents, 0);
  const history = visible.filter(invoice => invoice.id !== highlight?.id);
  return { years, highlight, history, overdueCount, paidCents };
}
