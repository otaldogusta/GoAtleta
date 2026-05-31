import {
  buildCompactSessionPlanDetails,
  shouldShowUnavailableResistanceNotice,
} from "../session-ui-policy";

describe("session-ui-policy", () => {
  it("monta apenas os três detalhes operacionais do plano", () => {
    expect(
      buildCompactSessionPlanDetails({
        focusLabel: "Levantamento",
        successCriterionLabel: "3 execuções corretas por estação",
        suggestedAdjustmentLabel: "Manter complexidade",
      })
    ).toEqual([
      { label: "Foco", value: "Levantamento" },
      { label: "Critério de sucesso", value: "3 execuções corretas por estação" },
      { label: "Ajuste sugerido", value: "Manter complexidade" },
    ]);
  });

  it("usa fallback sem expor análise longa quando falta dado", () => {
    expect(
      buildCompactSessionPlanDetails({
        focusLabel: "",
        successCriterionLabel: null,
        suggestedAdjustmentLabel: undefined,
        noDataLabel: "Sem dado",
      })
    ).toEqual([
      { label: "Foco", value: "Sem dado" },
      { label: "Critério de sucesso", value: "Sem dado" },
      { label: "Ajuste sugerido", value: "Sem dado" },
    ]);
  });

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
