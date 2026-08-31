export type PersistedSubscriptionStatus =
  "trialing" | "active" | "past_due" | "paused" | "canceled" | "expired";

export type PersistedMerchantStatus =
  "pending" | "active" | "restricted" | "disconnected";

export type PersistedFinanceSettings = {
  subscriptionStatus: PersistedSubscriptionStatus | null;
  merchantStatus: PersistedMerchantStatus | null;
};

const subscriptionStatusLabels: Record<PersistedSubscriptionStatus, string> = {
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Pagamento pendente",
  paused: "Pausada",
  canceled: "Cancelada",
  expired: "Expirada",
};

const merchantStatusLabels: Record<PersistedMerchantStatus, string> = {
  pending: "Em análise",
  active: "Conectado",
  restricted: "Ação necessária",
  disconnected: "Desconectado",
};

export const resolveFinanceSettingsDisplay = ({
  capabilityEnabled,
  persisted,
}: {
  capabilityEnabled: boolean;
  persisted: PersistedFinanceSettings | null;
}) => ({
  subscriptionStatusLabel: persisted?.subscriptionStatus
    ? subscriptionStatusLabels[persisted.subscriptionStatus]
    : "Não configurada",
  merchantStatusLabel: persisted?.merchantStatus
    ? merchantStatusLabels[persisted.merchantStatus]
    : "Não conectado",
  capabilityLabel: capabilityEnabled
    ? "Integração técnica disponível; ativação ainda não configurada."
    : "Integração técnica ainda não habilitada.",
});
