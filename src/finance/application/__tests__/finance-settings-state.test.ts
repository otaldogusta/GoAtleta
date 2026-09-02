import { resolveFinanceSettingsDisplay } from "../finance-settings-state";

describe("finance settings display state", () => {
  it("does not infer active commercial state from the feature flag", () => {
    expect(
      resolveFinanceSettingsDisplay({
        capabilityEnabled: true,
        persisted: null,
      }),
    ).toMatchObject({
      subscriptionStatusLabel: "Não configurada",
      merchantStatusLabel: "Não conectado",
    });
  });

  it("shows active states only when they were persisted", () => {
    expect(
      resolveFinanceSettingsDisplay({
        capabilityEnabled: true,
        persisted: {
          subscriptionStatus: "active",
          merchantStatus: "active",
          connectionMode: "active",
        },
      }),
    ).toMatchObject({
      subscriptionStatusLabel: "Ativa",
      merchantStatusLabel: "Conectado",
    });
  });

  it("distinguishes a read-only connector from payment activation", () => {
    expect(
      resolveFinanceSettingsDisplay({
        capabilityEnabled: false,
        connectorPrepared: true,
        persisted: {
          subscriptionStatus: null,
          merchantStatus: "active",
          connectionMode: "read_only",
        },
      }),
    ).toEqual({
      subscriptionStatusLabel: "Não configurada",
      merchantStatusLabel: "Conectado em leitura",
      capabilityLabel:
        "Acompanhamento disponível. A emissão de cobranças permanece bloqueada.",
    });
  });

  it("reports a prepared connector without implying it is connected", () => {
    expect(
      resolveFinanceSettingsDisplay({
        capabilityEnabled: false,
        connectorPrepared: true,
        persisted: null,
      }),
    ).toMatchObject({
      merchantStatusLabel: "Não conectado",
      capabilityLabel:
        "Conector pronto para importar o histórico. Cobranças reais permanecem bloqueadas.",
    });
  });
});
