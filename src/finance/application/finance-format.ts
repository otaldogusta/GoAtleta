import type { InvoiceStatus } from "../../core/payments";

export type { InvoiceStatus } from "../../core/payments";

export const formatMoneyFromCents = (
  cents: number,
  locale = "pt-BR",
  currency = "BRL"
) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(Number.isFinite(cents) ? cents / 100 : 0);

export const formatFinanceDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(parsed);
};

export const parseMoneyInputToCents = (value: string) => {
  const normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return null;
  const decimal = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  if (!/^\d+(?:\.\d{1,2})?$/.test(decimal)) return null;
  const amount = Number(decimal);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : null;
};

export const getInvoiceOutstandingCents = (
  amountCents: number,
  paidCents: number
) => {
  const total = Number.isFinite(amountCents)
    ? Math.max(0, Math.trunc(amountCents))
    : 0;
  const paid = Number.isFinite(paidCents)
    ? Math.max(0, Math.trunc(paidCents))
    : 0;
  return Math.max(0, total - paid);
};

export const toFinancePaidAtIso = (dateOnly: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const parsed = new Date(`${dateOnly}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const [year, month, day] = dateOnly.split("-").map(Number);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed.toISOString();
};

export const isFinancePaidDateAllowed = (
  dateOnly: string,
  latestDateOnly: string,
) =>
  toFinancePaidAtIso(dateOnly) !== null &&
  /^\d{4}-\d{2}-\d{2}$/.test(latestDateOnly) &&
  dateOnly <= latestDateOnly;

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  draft: "Rascunho",
  open: "Em aberto",
  awaiting_payment: "Aguardando",
  overdue: "Vencida",
  partially_paid: "Parcial",
  paid: "Paga",
  canceled: "Cancelada",
  partially_refunded: "Estorno parcial",
  refunded: "Estornada",
  disputed: "Em contestação",
};

export const normalizeInvoiceStatus = (value: unknown): InvoiceStatus => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "pending") return "awaiting_payment";
  if (normalized === "void" || normalized === "cancelled") return "canceled";
  const supported: readonly InvoiceStatus[] = [
    "draft",
    "open",
    "awaiting_payment",
    "partially_paid",
    "paid",
    "overdue",
    "canceled",
    "partially_refunded",
    "refunded",
    "disputed",
  ];
  if (supported.includes(normalized as InvoiceStatus)) return normalized as InvoiceStatus;
  return "open";
};

export const canRecordManualPaymentForInvoice = ({
  amountCents,
  paidCents,
  status,
}: {
  amountCents: number;
  paidCents: number;
  status: InvoiceStatus;
}) =>
  getInvoiceOutstandingCents(amountCents, paidCents) > 0 &&
  (["open", "awaiting_payment", "partially_paid", "overdue"] as const).includes(
    status as "open" | "awaiting_payment" | "partially_paid" | "overdue"
  );
