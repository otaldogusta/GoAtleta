import { supabaseRestPost } from "./rest";
import { createClientId } from "../core/client-id";
import {
  normalizeInvoiceStatus,
  type InvoiceStatus,
} from "../finance/application/finance-format";

export type OrganizationFinanceSummary = {
  organizationId: string;
  expectedCents: number;
  receivedCents: number;
  overdueCents: number;
  openCents: number;
  overdueCount: number;
  openCount: number;
  paidCount: number;
  activeAgreementsCount: number;
};

export type OrganizationInvoice = {
  id: string;
  studentId: string;
  studentName: string;
  competenceMonth: string;
  dueDate: string;
  amountCents: number;
  paidCents: number;
  status: InvoiceStatus;
  description: string;
  createdAt: string;
  paidAt: string | null;
};

export type TuitionPlan = {
  id: string;
  name: string;
  description: string | null;
  amountCents: number;
  currency: "BRL";
  dueDay: number;
  active: boolean;
  createdAt: string;
};

export type TuitionAgreement = {
  id: string;
  studentId: string;
  studentName: string;
  planId: string;
  planName: string;
  payerUserId: string | null;
  status: "active" | "paused" | "canceled" | "completed";
  startsOn: string;
  endsOn: string | null;
  amountCents: number;
  dueDay: number;
};

export type ManualPaymentResult = {
  paymentId: string;
  invoiceStatus: InvoiceStatus;
  paidCents: number;
};

export type OrganizationProviderReceivable = {
  id: string;
  customerName: string;
  providerStatus: string;
  billingType: string;
  amountCents: number;
  netAmountCents: number;
  dueDate: string | null;
  paidAt: string | null;
  matchStatus: "matched" | "ambiguous" | "unmatched";
  invoiceId: string | null;
  importedAt: string;
};

type FinanceSummaryRow = {
  organization_id: string;
  expected_cents: number | string | null;
  received_cents: number | string | null;
  overdue_cents: number | string | null;
  open_cents: number | string | null;
  overdue_count: number | string | null;
  open_count: number | string | null;
  paid_count: number | string | null;
  active_agreements_count: number | string | null;
};

type OrganizationInvoiceRow = {
  invoice_id: string;
  student_id: string;
  student_name: string | null;
  competence_month: string;
  due_date: string;
  amount_cents: number | string;
  paid_cents: number | string | null;
  status: string;
  description: string | null;
  created_at: string;
  paid_at: string | null;
};

type TuitionPlanRow = {
  plan_id: string;
  name: string;
  description: string | null;
  amount_cents: number | string;
  currency: string;
  due_day: number | string;
  active: boolean;
  created_at: string;
};

type TuitionAgreementRow = {
  agreement_id: string;
  student_id: string;
  student_name: string;
  plan_id: string;
  plan_name: string;
  payer_user_id: string | null;
  status: TuitionAgreement["status"];
  start_date: string;
  end_date: string | null;
  amount_cents: number | string;
  due_day: number | string;
};

type ManualPaymentRow = {
  payment_id: string;
  invoice_status: string;
  paid_cents: number | string;
};

type OrganizationProviderReceivableRow = {
  receivable_id: string;
  customer_name: string | null;
  provider_status: string;
  billing_type: string;
  amount_cents: number | string;
  net_amount_cents: number | string | null;
  due_date: string | null;
  paid_at: string | null;
  match_status: string;
  invoice_id: string | null;
  imported_at: string;
};

const toSafeInteger = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
};

export const mapFinanceSummary = (
  row: FinanceSummaryRow | null | undefined,
  organizationId: string,
): OrganizationFinanceSummary => ({
  organizationId: row?.organization_id ?? organizationId,
  expectedCents: toSafeInteger(row?.expected_cents),
  receivedCents: toSafeInteger(row?.received_cents),
  overdueCents: toSafeInteger(row?.overdue_cents),
  openCents: toSafeInteger(row?.open_cents),
  overdueCount: toSafeInteger(row?.overdue_count),
  openCount: toSafeInteger(row?.open_count),
  paidCount: toSafeInteger(row?.paid_count),
  activeAgreementsCount: toSafeInteger(row?.active_agreements_count),
});

export const mapOrganizationInvoice = (
  row: OrganizationInvoiceRow,
): OrganizationInvoice => ({
  id: row.invoice_id,
  studentId: row.student_id,
  studentName: row.student_name?.trim() || "Atleta",
  competenceMonth: row.competence_month,
  dueDate: row.due_date,
  amountCents: toSafeInteger(row.amount_cents),
  paidCents: toSafeInteger(row.paid_cents),
  status: normalizeInvoiceStatus(row.status),
  description: row.description?.trim() || "Mensalidade",
  createdAt: row.created_at,
  paidAt: row.paid_at,
});

export const mapTuitionPlan = (row: TuitionPlanRow): TuitionPlan => ({
  id: row.plan_id,
  name: row.name.trim(),
  description: row.description?.trim() || null,
  amountCents: toSafeInteger(row.amount_cents),
  currency: "BRL",
  dueDay: toSafeInteger(row.due_day),
  active: row.active === true,
  createdAt: row.created_at,
});

export const mapTuitionAgreement = (
  row: TuitionAgreementRow,
): TuitionAgreement => ({
  id: row.agreement_id,
  studentId: row.student_id,
  studentName: row.student_name.trim() || "Atleta",
  planId: row.plan_id,
  planName: row.plan_name.trim() || "Plano",
  payerUserId: row.payer_user_id,
  status: row.status,
  startsOn: row.start_date,
  endsOn: row.end_date,
  amountCents: toSafeInteger(row.amount_cents),
  dueDay: toSafeInteger(row.due_day),
});

export const mapOrganizationProviderReceivable = (
  row: OrganizationProviderReceivableRow,
): OrganizationProviderReceivable => ({
  id: row.receivable_id,
  customerName: row.customer_name?.trim() || "Cliente Asaas",
  providerStatus: row.provider_status.trim().toUpperCase(),
  billingType: row.billing_type.trim().toUpperCase(),
  amountCents: toSafeInteger(row.amount_cents),
  netAmountCents: toSafeInteger(row.net_amount_cents ?? row.amount_cents),
  dueDate: row.due_date,
  paidAt: row.paid_at,
  matchStatus: ["matched", "ambiguous", "unmatched"].includes(row.match_status)
    ? (row.match_status as OrganizationProviderReceivable["matchStatus"])
    : "unmatched",
  invoiceId: row.invoice_id,
  importedAt: row.imported_at,
});

const unwrapScalarId = (payload: unknown) => {
  if (typeof payload === "string") return payload;
  if (
    Array.isArray(payload) &&
    payload.length === 1 &&
    typeof payload[0] === "string"
  ) {
    return payload[0];
  }
  return "";
};

export async function getOrganizationFinanceDashboard(
  organizationId: string,
): Promise<OrganizationFinanceSummary> {
  const rows = await supabaseRestPost<FinanceSummaryRow[]>(
    "/rpc/get_organization_finance_dashboard_v1",
    { p_org_id: organizationId },
  );
  return mapFinanceSummary(rows?.[0], organizationId);
}

export async function listOrganizationInvoices(
  organizationId: string,
  status?: InvoiceStatus | null,
): Promise<OrganizationInvoice[]> {
  const rows = await supabaseRestPost<OrganizationInvoiceRow[]>(
    "/rpc/list_organization_invoices_v1",
    { p_org_id: organizationId, p_status: status ?? null },
  );
  return (rows ?? []).map(mapOrganizationInvoice);
}

export async function listOrganizationProviderReceivables(
  organizationId: string,
  month: string,
  limit = 250,
): Promise<OrganizationProviderReceivable[]> {
  const rows = await supabaseRestPost<OrganizationProviderReceivableRow[]>(
    "/rpc/list_organization_provider_receivables_v1",
    {
      p_org_id: organizationId,
      p_month: `${month}-01`,
      p_limit: Math.min(Math.max(Math.trunc(limit), 1), 500),
    },
  );
  return (rows ?? []).map(mapOrganizationProviderReceivable);
}

export async function listTuitionPlans(
  organizationId: string,
): Promise<TuitionPlan[]> {
  const rows = await supabaseRestPost<TuitionPlanRow[]>(
    "/rpc/list_tuition_plans_v1",
    { p_org_id: organizationId },
  );
  return (rows ?? []).map(mapTuitionPlan);
}

export async function listTuitionAgreements(
  organizationId: string,
): Promise<TuitionAgreement[]> {
  const rows = await supabaseRestPost<TuitionAgreementRow[]>(
    "/rpc/list_tuition_agreements_v1",
    { p_org_id: organizationId },
  );
  return (rows ?? []).map(mapTuitionAgreement);
}

export async function createTuitionPlan(input: {
  organizationId: string;
  name: string;
  amountCents: number;
  dueDay: number;
  description?: string | null;
  idempotencyKey?: string;
}) {
  const result = await supabaseRestPost<unknown>(
    "/rpc/create_tuition_plan_v1",
    {
      p_org_id: input.organizationId,
      p_name: input.name.trim(),
      p_amount_cents: Math.trunc(input.amountCents),
      p_billing_day: Math.trunc(input.dueDay),
      p_idempotency_key: input.idempotencyKey ?? createClientId(),
      p_description: input.description?.trim() || null,
    },
  );
  const id = unwrapScalarId(result);
  if (!id) throw new Error("A criação do plano não retornou um identificador.");
  return id;
}

export async function createTuitionAgreement(input: {
  organizationId: string;
  studentId: string;
  planId: string;
  payerRelationshipId: string;
  startsOn: string;
  endsOn?: string | null;
  amountCents?: number | null;
  dueDay?: number | null;
  idempotencyKey?: string;
}) {
  const result = await supabaseRestPost<unknown>(
    "/rpc/create_tuition_agreement_v1",
    {
      p_org_id: input.organizationId,
      p_student_id: input.studentId,
      p_plan_id: input.planId,
      p_payer_relationship_id: input.payerRelationshipId,
      p_starts_on: input.startsOn,
      p_idempotency_key: input.idempotencyKey ?? createClientId(),
      p_ends_on: input.endsOn ?? null,
      p_amount_cents:
        input.amountCents == null ? null : Math.trunc(input.amountCents),
      p_billing_day: input.dueDay == null ? null : Math.trunc(input.dueDay),
    },
  );
  const id = unwrapScalarId(result);
  if (!id)
    throw new Error("A criação do acordo não retornou um identificador.");
  return id;
}

export async function issueTuitionInvoice(input: {
  organizationId: string;
  agreementId: string;
  competenceMonth: string;
  dueDate: string;
  description?: string | null;
  idempotencyKey?: string;
}) {
  const result = await supabaseRestPost<unknown>(
    "/rpc/issue_tuition_invoice_v1",
    {
      p_org_id: input.organizationId,
      p_agreement_id: input.agreementId,
      p_competence_month: input.competenceMonth,
      p_due_date: input.dueDate,
      p_idempotency_key: input.idempotencyKey ?? createClientId(),
      p_description: input.description?.trim() || null,
    },
  );
  const id = unwrapScalarId(result);
  if (!id) throw new Error("A emissão não retornou um identificador.");
  return id;
}

export async function recordManualPayment(input: {
  organizationId: string;
  invoiceId: string;
  amountCents: number;
  method: "pix" | "boleto" | "card" | "cash" | "bank_transfer" | "other";
  paidAt?: string;
  notes?: string | null;
  idempotencyKey?: string;
}): Promise<ManualPaymentResult> {
  const rows = await supabaseRestPost<ManualPaymentRow[]>(
    "/rpc/record_manual_payment_v1",
    {
      p_org_id: input.organizationId,
      p_invoice_id: input.invoiceId,
      p_amount_cents: Math.trunc(input.amountCents),
      p_method: input.method,
      p_idempotency_key: input.idempotencyKey ?? createClientId(),
      p_paid_at: input.paidAt ?? new Date().toISOString(),
      p_notes: input.notes?.trim() || null,
    },
  );
  const row = rows?.[0];
  if (!row?.payment_id)
    throw new Error("O registro não retornou um pagamento.");
  return {
    paymentId: row.payment_id,
    invoiceStatus: normalizeInvoiceStatus(row.invoice_status),
    paidCents: toSafeInteger(row.paid_cents),
  };
}
