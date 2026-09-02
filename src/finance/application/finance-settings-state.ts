export type PersistedSubscriptionStatus =
  "trialing" | "active" | "past_due" | "paused" | "canceled" | "expired";

export type PersistedMerchantStatus =
  "pending" | "active" | "restricted" | "disconnected";

export type PersistedFinanceSettings = {
  subscriptionStatus: PersistedSubscriptionStatus | null;
  merchantStatus: PersistedMerchantStatus | null;
  connectionMode?: "read_only" | "active" | null;
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
  connectorPrepared = false,
  persisted,
}: {
  capabilityEnabled: boolean;
  connectorPrepared?: boolean;
  persisted: PersistedFinanceSettings | null;
}) => {
  const connectedReadOnly =
    persisted?.merchantStatus === "active" &&
    persisted.connectionMode === "read_only";

  return {
    subscriptionStatusLabel: persisted?.subscriptionStatus
      ? subscriptionStatusLabels[persisted.subscriptionStatus]
      : "Não configurada",
    merchantStatusLabel: connectedReadOnly
      ? "Conectado em leitura"
      : persisted?.merchantStatus
        ? merchantStatusLabels[persisted.merchantStatus]
        : "Não conectado",
    capabilityLabel: connectedReadOnly
      ? "Acompanhamento disponível. A emissão de cobranças permanece bloqueada."
      : connectorPrepared
        ? "Conector pronto para importar o histórico. Cobranças reais permanecem bloqueadas."
        : capabilityEnabled
          ? "Integração técnica disponível; ativação ainda não configurada."
          : "Integração técnica ainda não habilitada.",
  };
};
