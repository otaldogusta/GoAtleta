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
        },
      }),
    ).toMatchObject({
      subscriptionStatusLabel: "Ativa",
      merchantStatusLabel: "Conectado",
    });
  });
});
