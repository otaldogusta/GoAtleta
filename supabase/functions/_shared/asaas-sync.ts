import type {
  AsaasCustomer,
  AsaasPayment,
  AsaasSubscription,
} from "./asaas-client.ts";

export type ProviderMatchStatus = "matched" | "ambiguous" | "unmatched";

const textValue = (value: unknown) => String(value ?? "").trim();

const safeExternalValue = (value: unknown, maxLength = 255) =>
  textValue(value).slice(0, maxLength) || null;

const normalizedStatus = (value: unknown, fallback: string) =>
  textValue(value)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_")
    .slice(0, 80) || fallback;

export const moneyToCents = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
};

export const maskProviderEmail = (value: unknown) => {
  const normalized = textValue(value).toLowerCase();
  const [local = "", domain = ""] = normalized.split("@");
  if (!local || !domain) return null;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, Math.min(8, local.length - visible.length)))}@${domain}`;
};

export const providerEmailCandidates = (customer: AsaasCustomer) => {
  const values = [
    customer.email,
    ...textValue(customer.additionalEmails).split(","),
  ];
  return Array.from(
    new Set(
      values
        .map((value) => textValue(value).toLowerCase())
        .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)),
    ),
  );
};

export const matchStatusForCount = (count: number): ProviderMatchStatus =>
  count === 1 ? "matched" : count > 1 ? "ambiguous" : "unmatched";

export const mapAsaasCustomerRecord = (params: {
  organizationId: string;
  connectionId: string;
  customer: AsaasCustomer;
  matchStatus: ProviderMatchStatus;
}) => {
  const document = textValue(params.customer.cpfCnpj).replace(/\D/g, "");
  return {
    organization_id: params.organizationId,
    connection_id: params.connectionId,
    provider: "asaas",
    external_customer_id: textValue(params.customer.id),
    external_reference: safeExternalValue(params.customer.externalReference),
    display_name: textValue(params.customer.name).slice(0, 200) || "Cliente Asaas",
    email_masked: maskProviderEmail(params.customer.email),
    document_last4: document.length >= 4 ? document.slice(-4) : null,
    match_status: params.matchStatus,
    imported_at: new Date().toISOString(),
  };
};

const paymentDate = (payment: AsaasPayment) => {
  const value = textValue(
    payment.paymentDate ?? payment.confirmedDate ?? payment.clientPaymentDate,
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return `${value}T12:00:00.000Z`;
};

export const mapAsaasPaymentRecord = (params: {
  organizationId: string;
  connectionId: string;
  payment: AsaasPayment;
  matchStatus: ProviderMatchStatus;
  invoiceId?: string | null;
}) => ({
  organization_id: params.organizationId,
  connection_id: params.connectionId,
  provider: "asaas",
  external_payment_id: textValue(params.payment.id),
  external_customer_id: textValue(params.payment.customer),
  external_subscription_id: safeExternalValue(params.payment.subscription, 160),
  external_reference: safeExternalValue(params.payment.externalReference),
  provider_status: normalizedStatus(params.payment.status, "UNKNOWN"),
  billing_type: normalizedStatus(params.payment.billingType, "UNDEFINED").slice(0, 40),
  amount_cents: moneyToCents(params.payment.value),
  net_amount_cents:
    params.payment.netValue == null
      ? null
      : moneyToCents(params.payment.netValue),
  due_date: /^\d{4}-\d{2}-\d{2}$/.test(textValue(params.payment.dueDate))
    ? textValue(params.payment.dueDate)
    : null,
  paid_at: paymentDate(params.payment),
  invoice_id: params.invoiceId ?? null,
  match_status: params.matchStatus,
  imported_at: new Date().toISOString(),
});

export const mapAsaasSubscriptionRecord = (params: {
  organizationId: string;
  connectionId: string;
  subscription: AsaasSubscription;
  matchStatus: ProviderMatchStatus;
}) => ({
  organization_id: params.organizationId,
  connection_id: params.connectionId,
  provider: "asaas",
  external_subscription_id: textValue(params.subscription.id),
  external_customer_id: textValue(params.subscription.customer),
  external_reference: safeExternalValue(params.subscription.externalReference),
  provider_status: normalizedStatus(params.subscription.status, "UNKNOWN"),
  billing_type: normalizedStatus(
    params.subscription.billingType,
    "UNDEFINED",
  ).slice(0, 40),
  billing_cycle: normalizedStatus(params.subscription.cycle, "MONTHLY").slice(0, 40),
  amount_cents: moneyToCents(params.subscription.value),
  next_due_date: /^\d{4}-\d{2}-\d{2}$/.test(
    textValue(params.subscription.nextDueDate),
  )
    ? textValue(params.subscription.nextDueDate)
    : null,
  agreement_id: null,
  match_status: params.matchStatus,
  imported_at: new Date().toISOString(),
});

export const isUsableAsaasCustomer = (customer: AsaasCustomer) =>
  Boolean(textValue(customer.id)) && customer.deleted !== true;

export const isUsableAsaasPayment = (payment: AsaasPayment) =>
  Boolean(textValue(payment.id)) && Boolean(textValue(payment.customer));

export const isUsableAsaasSubscription = (subscription: AsaasSubscription) =>
  Boolean(textValue(subscription.id)) && Boolean(textValue(subscription.customer));
