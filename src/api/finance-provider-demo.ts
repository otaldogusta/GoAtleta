import type {
  FinanceProviderConnection,
  FinanceProviderConnectionStatus,
} from "./finance-provider";

type FinanceProviderDemoAction = "verify" | "sync" | "webhook";

type FinanceProviderDemoState = {
  connection: FinanceProviderConnection;
  canManageConnection: boolean;
};

const demoByOrganization = new Map<string, FinanceProviderDemoState>();

const waitForDemoFeedback = () =>
  new Promise((resolve) => setTimeout(resolve, 250));

const assertDemoAvailable = () => {
  if (!__DEV__) throw new Error("Demonstração disponível apenas localmente.");
};

const statusFromState = (
  state: FinanceProviderDemoState,
  action: string,
): FinanceProviderConnectionStatus => ({
  status: "connected",
  canManageConnection: state.canManageConnection,
  connection: state.connection,
  receipt: { action, readOnly: true },
});

export const getFinanceProviderDemoStatus = (
  organizationId: string,
): FinanceProviderConnectionStatus | null => {
  if (!__DEV__) return null;
  const state = demoByOrganization.get(organizationId);
  return state ? statusFromState(state, "demo_status") : null;
};

export const startFinanceProviderDemo = async (
  organizationId: string,
  canManageConnection: boolean,
): Promise<FinanceProviderConnectionStatus> => {
  assertDemoAvailable();
  if (!organizationId.trim()) throw new Error("Instituição não selecionada.");
  await waitForDemoFeedback();

  const now = new Date().toISOString();
  const state: FinanceProviderDemoState = {
    canManageConnection,
    connection: {
      provider: "asaas",
      environment: "sandbox",
      mode: "read_only",
      merchantStatus: "active",
      accountStatus: "ACTIVE",
      keyHint: "••••DEMO",
      webhookStatus: "not_configured",
      lastVerifiedAt: now,
      lastSyncAt: null,
      chargesEnabled: false,
      sync: null,
    },
  };
  demoByOrganization.set(organizationId, state);
  return statusFromState(state, "demo_connected");
};

export const runFinanceProviderDemoAction = async (
  organizationId: string,
  action: FinanceProviderDemoAction,
): Promise<FinanceProviderConnectionStatus> => {
  assertDemoAvailable();
  const state = demoByOrganization.get(organizationId);
  if (!state) throw new Error("Inicie a demonstração antes de continuar.");
  await waitForDemoFeedback();

  const now = new Date().toISOString();
  if (action === "verify") {
    state.connection.lastVerifiedAt = now;
  } else if (action === "sync") {
    state.connection.lastSyncAt = now;
    state.connection.sync = {
      customerCount: 36,
      matchedCustomerCount: 31,
      ambiguousCustomerCount: 2,
      paymentCount: 84,
      subscriptionCount: 28,
      truncated: false,
      completedAt: now,
    };
  } else {
    state.connection.webhookStatus = "configured";
  }

  return statusFromState(state, `demo_${action}`);
};

export const stopFinanceProviderDemo = async (
  organizationId: string,
  canManageConnection: boolean,
): Promise<FinanceProviderConnectionStatus> => {
  assertDemoAvailable();
  await waitForDemoFeedback();
  demoByOrganization.delete(organizationId);
  return {
    status: "not_connected",
    canManageConnection,
    connection: null,
    receipt: {
      action: "demo_disconnected",
      readOnly: true,
      historyPreserved: false,
    },
  };
};
