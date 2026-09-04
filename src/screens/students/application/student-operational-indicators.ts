import type { OrganizationInvoice } from "../../../api/finance";
import type { AttendanceRecord } from "../../../core/models";
import { getInvoiceOutstandingCents } from "../../../finance/application/finance-format";

export type StudentOperationalIndicatorTone =
  "success" | "warning" | "danger" | "neutral";

export type StudentOperationalIndicator = {
  label: string;
  detail: string;
  tone: StudentOperationalIndicatorTone;
};

export type StudentFinanceSummary = {
  outstandingCents: number;
  overdueCents: number;
  nextDueDate: string | null;
  latestInvoice: OrganizationInvoice | null;
  lastPaidAt: string | null;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ACTIONABLE_INVOICE_STATUSES = new Set([
  "open",
  "awaiting_payment",
  "partially_paid",
  "overdue",
  "disputed",
]);

const parseLocalDate = (value: string) => {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);

const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

const isInvoiceOverdue = (invoice: OrganizationInvoice, today: Date) => {
  if (invoice.status === "overdue" || invoice.status === "disputed") return true;
  const dueDate = parseLocalDate(invoice.dueDate);
  return Boolean(dueDate && dueDate < today);
};

export const deriveStudentFinanceSummary = (
  invoices: OrganizationInvoice[],
  now = new Date(),
): StudentFinanceSummary => {
  const today = startOfLocalDay(now);
  let outstandingCents = 0;
  let overdueCents = 0;
  let nextDueDate: string | null = null;
  let latestInvoice: OrganizationInvoice | null = null;
  let lastPaidAt: string | null = null;

  for (const invoice of invoices) {
    if (!latestInvoice || invoice.createdAt > latestInvoice.createdAt) {
      latestInvoice = invoice;
    }
    if (invoice.status === "paid" && invoice.paidAt && parseLocalDate(invoice.paidAt)) {
      if (!lastPaidAt || new Date(invoice.paidAt) > new Date(lastPaidAt)) {
        lastPaidAt = invoice.paidAt;
      }
    }
    const outstanding = getInvoiceOutstandingCents(invoice.amountCents, invoice.paidCents);
    if (!ACTIONABLE_INVOICE_STATUSES.has(invoice.status) || outstanding === 0) continue;
    outstandingCents += outstanding;
    if (isInvoiceOverdue(invoice, today)) {
      overdueCents += outstanding;
    } else if (parseLocalDate(invoice.dueDate) && (!nextDueDate || invoice.dueDate < nextDueDate)) {
      nextDueDate = invoice.dueDate;
    }
  }

  return { outstandingCents, overdueCents, nextDueDate, latestInvoice, lastPaidAt };
};

export const deriveStudentFinanceIndicator = (
  invoices: OrganizationInvoice[],
  now = new Date(),
): StudentOperationalIndicator => {
  const today = startOfLocalDay(now);
  const actionable = invoices.filter(
    (invoice) =>
      ACTIONABLE_INVOICE_STATUSES.has(invoice.status) &&
      getInvoiceOutstandingCents(invoice.amountCents, invoice.paidCents) > 0,
  );
  const overdue = actionable.filter((invoice) => isInvoiceOverdue(invoice, today));

  if (overdue.length > 0) {
    return {
      label: "Em atraso",
      detail: pluralize(
        overdue.length,
        "cobrança vencida",
        "cobranças vencidas",
      ),
      tone: "danger",
    };
  }

  const partiallyPaid = actionable.filter(
    (invoice) => invoice.status === "partially_paid" || invoice.paidCents > 0,
  );
  if (partiallyPaid.length > 0) {
    return {
      label: "Pagamento parcial",
      detail: pluralize(
        partiallyPaid.length,
        "cobrança com saldo",
        "cobranças com saldo",
      ),
      tone: "warning",
    };
  }

  if (actionable.length > 0) {
    return {
      label: "Em aberto",
      detail: pluralize(
        actionable.length,
        "cobrança aguardando pagamento",
        "cobranças aguardando pagamento",
      ),
      tone: "warning",
    };
  }

  if (invoices.some((invoice) => invoice.status === "paid")) {
    return {
      label: "Em dia",
      detail: "Nenhuma cobrança pendente",
      tone: "success",
    };
  }

  return {
    label: "Sem cobrança",
    detail: "Nenhuma mensalidade encontrada",
    tone: "neutral",
  };
};

export const deriveStudentAttendanceIndicator = (
  records: AttendanceRecord[],
  now = new Date(),
): StudentOperationalIndicator => {
  if (records.length === 0) {
    return {
      label: "Sem registros",
      detail: "Nenhuma chamada registrada",
      tone: "neutral",
    };
  }

  const today = startOfLocalDay(now);
  const thirtyDaysAgo = new Date(today.getTime() - 29 * DAY_IN_MS);
  const ordered = records
    .map((record) => ({ record, date: parseLocalDate(record.date) }))
    .filter((entry): entry is { record: AttendanceRecord; date: Date } =>
      Boolean(entry.date && entry.date <= today),
    )
    .sort((left, right) => right.date.getTime() - left.date.getTime());
  const recentAbsences = ordered.filter(
    ({ record, date }) => record.status === "faltou" && date >= thirtyDaysAgo,
  );
  let consecutiveAbsences = 0;
  for (const { record } of ordered) {
    if (record.status !== "faltou") break;
    consecutiveAbsences += 1;
  }

  if (consecutiveAbsences >= 3) {
    return {
      label: "Atenção",
      detail: pluralize(
        consecutiveAbsences,
        "falta seguida",
        "faltas seguidas",
      ),
      tone: "danger",
    };
  }

  if (recentAbsences.length > 0) {
    return {
      label: "Acompanhar",
      detail: `${pluralize(recentAbsences.length, "falta", "faltas")} nos últimos 30 dias`,
      tone: "warning",
    };
  }

  return {
    label: "Sem alerta",
    detail: "Nenhuma falta nos últimos 30 dias",
    tone: "success",
  };
};

export const LOADING_FINANCE_INDICATOR: StudentOperationalIndicator = {
  label: "Verificando",
  detail: "Consultando cobranças",
  tone: "neutral",
};

export const LOADING_ATTENDANCE_INDICATOR: StudentOperationalIndicator = {
  label: "Verificando",
  detail: "Consultando frequência",
  tone: "neutral",
};

export const UNAVAILABLE_FINANCE_INDICATOR: StudentOperationalIndicator = {
  label: "Indisponível",
  detail: "Não foi possível consultar as cobranças",
  tone: "neutral",
};

export const UNAVAILABLE_ATTENDANCE_INDICATOR: StudentOperationalIndicator = {
  label: "Indisponível",
  detail: "Não foi possível consultar a frequência",
  tone: "neutral",
};
