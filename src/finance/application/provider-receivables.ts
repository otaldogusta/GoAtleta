import type { OrganizationProviderReceivable } from "../../api/finance";

const RECEIVED_STATUSES = new Set([
  "RECEIVED",
  "RECEIVED_IN_CASH",
  "DUNNING_RECEIVED",
]);

const PROVIDER_STATUS_LABELS: Record<string, string> = {
  AWAITING_RISK_ANALYSIS: "Em análise",
  CHARGEBACK_DISPUTE: "Contestada",
  CHARGEBACK_REQUESTED: "Contestada",
  CONFIRMED: "Confirmada",
  DUNNING_RECEIVED: "Recebida",
  DUNNING_REQUESTED: "Em recuperação",
  OVERDUE: "Vencida",
  PENDING: "Em aberto",
  RECEIVED: "Recebida",
  RECEIVED_IN_CASH: "Recebida",
  REFUNDED: "Estornada",
  REFUND_REQUESTED: "Estorno solicitado",
};

const BILLING_TYPE_LABELS: Record<string, string> = {
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão",
  DEBIT_CARD: "Débito",
  PIX: "Pix",
  TRANSFER: "Transferência",
  UNDEFINED: "Não informado",
};

export type ProviderReceivablesSummary = {
  totalCount: number;
  receivedCount: number;
  receivedGrossCents: number;
  receivedNetCents: number;
  identifiedCustomerCount: number;
  reconciliationCount: number;
};

export const isProviderReceivableReceived = (
  receivable: Pick<OrganizationProviderReceivable, "providerStatus">,
) => RECEIVED_STATUSES.has(receivable.providerStatus.trim().toUpperCase());

export const summarizeProviderReceivables = (
  receivables: OrganizationProviderReceivable[],
): ProviderReceivablesSummary => {
  const received = receivables.filter(isProviderReceivableReceived);
  return {
    totalCount: receivables.length,
    receivedCount: received.length,
    receivedGrossCents: received.reduce(
      (total, receivable) => total + receivable.amountCents,
      0,
    ),
    receivedNetCents: received.reduce(
      (total, receivable) => total + receivable.netAmountCents,
      0,
    ),
    identifiedCustomerCount: receivables.filter(
      (receivable) => receivable.matchStatus === "matched",
    ).length,
    reconciliationCount: receivables.filter(
      (receivable) => receivable.matchStatus !== "matched",
    ).length,
  };
};

export const getProviderReceivableStatusLabel = (status: string) =>
  PROVIDER_STATUS_LABELS[status.trim().toUpperCase()] ?? "Atualizada";

export const getProviderReceivableBillingLabel = (billingType: string) =>
  BILLING_TYPE_LABELS[billingType.trim().toUpperCase()] ?? "Outro";

export const getProviderReceivableMatchLabel = (
  matchStatus: OrganizationProviderReceivable["matchStatus"],
) => {
  if (matchStatus === "matched") return "Cliente identificado";
  if (matchStatus === "ambiguous") return "Revisar vínculo";
  return "A conciliar";
};

export const getProviderReceivableDisplayDate = (
  receivable: Pick<OrganizationProviderReceivable, "paidAt" | "dueDate">,
) => receivable.paidAt?.slice(0, 10) || receivable.dueDate;
