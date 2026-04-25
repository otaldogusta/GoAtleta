import type { TeamTrainingContext, WeeklyIntegratedTrainingContext } from "../../models";
import { buildResistanceSessionPlan } from "../build-resistance-session-plan";

const teamContext: TeamTrainingContext = {
  hasGymAccess: true,
  integratedTrainingModel: "academia_integrada",
  resistanceTrainingProfile: "intermediario",
};

const baseWeeklyContext: WeeklyIntegratedTrainingContext = {
  weeklyPhysicalEmphasis: "manutencao",
  courtGymRelationship: "integrado_transferencia_direta",
  gymSessionsCount: 1,
  courtSessionsCount: 2,
  interferenceRisk: "baixo",
  notes: "Integração direta academia → quadra.",
};

describe("buildResistanceSessionPlan", () => {
  it("uses the weekly physical emphasis to specialize the selected template", () => {
    const component = buildResistanceSessionPlan({
      teamContext,
      weeklyContext: {
        ...baseWeeklyContext,
        weeklyPhysicalEmphasis: "velocidade_reatividade",
      },
      sessionRole: "consolidacao_orientada",
    });

    expect(component.resistancePlan.label).toBe("Potência Reativa e Velocidade");
    expect(component.resistancePlan.id).toBe(
      "tpl_potencia_atletica_intermediario_velocidade_reatividade"
    );
    expect(component.resistancePlan.transferTarget).toContain("bloqueio");
  });

  it("uses court-gym relationship to specialize eligible formal sessions", () => {
    const component = buildResistanceSessionPlan({
      teamContext,
      weeklyContext: {
        ...baseWeeklyContext,
        weeklyPhysicalEmphasis: "forca_base",
        courtGymRelationship: "integrado_transferencia_direta",
      },
      sessionRole: "consolidacao_orientada",
    });

    expect(component.resistancePlan.label).toBe(
      "Força Base com Transferência Direta"
    );
    expect(component.resistancePlan.transferTarget).toContain("ação seguinte");
  });

  it("keeps unload sessions on preventive templates even with aggressive emphasis", () => {
    const component = buildResistanceSessionPlan({
      teamContext,
      weeklyContext: {
        ...baseWeeklyContext,
        weeklyPhysicalEmphasis: "potencia_atletica",
      },
      sessionRole: "transferencia_jogo",
    });

    expect(component.resistancePlan.primaryGoal).toBe("prevencao_lesao");
    expect(component.resistancePlan.label).toBe("Prevenção e Estabilidade");
  });
});
