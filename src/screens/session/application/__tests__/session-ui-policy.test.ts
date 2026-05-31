import { shouldShowUnavailableResistanceNotice } from "../session-ui-policy";

describe("session-ui-policy", () => {
  it("mostra alerta resistido só quando academia ou mista precisa de ação", () => {
    expect(
      shouldShowUnavailableResistanceNotice({
        dismissed: false,
        sessionEnvironment: "academia",
        hasPersistedResistanceData: false,
      })
    ).toBe(true);
    expect(
      shouldShowUnavailableResistanceNotice({
        dismissed: false,
        sessionEnvironment: "mista",
        hasPersistedResistanceData: false,
      })
    ).toBe(true);
    expect(
      shouldShowUnavailableResistanceNotice({
        dismissed: false,
        sessionEnvironment: "quadra",
        hasPersistedResistanceData: false,
      })
    ).toBe(false);
    expect(
      shouldShowUnavailableResistanceNotice({
        dismissed: false,
        sessionEnvironment: "preventiva",
        hasPersistedResistanceData: false,
      })
    ).toBe(false);
  });

  it("não mostra alerta resistido quando foi dispensado ou já há bloco persistido", () => {
    expect(
      shouldShowUnavailableResistanceNotice({
        dismissed: true,
        sessionEnvironment: "academia",
        hasPersistedResistanceData: false,
      })
    ).toBe(false);
    expect(
      shouldShowUnavailableResistanceNotice({
        dismissed: false,
        sessionEnvironment: "mista",
        hasPersistedResistanceData: true,
      })
    ).toBe(false);
  });
});
