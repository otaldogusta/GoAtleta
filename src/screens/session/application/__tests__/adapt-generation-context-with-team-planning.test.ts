import type { TeamPlanningContext } from "../../../core/team-context";
import type { ClassGenerationContext } from "../build-class-generation-context";
import { adaptGenerationContextWithTeamPlanning } from "../adapt-generation-context-with-team-planning";

const baseContext: ClassGenerationContext = {
  classId: "class_1",
  sessionDate: "2026-05-08",
  modality: "voleibol",
  classLevel: 2,
  ageBand: "12-14",
  developmentStage: "especializado",
  planningPhase: "desenvolvimento",
  weekNumber: 2,
  rpeTarget: 5,
  phaseIntent: "estabilizacao_tecnica",
  weeklyLoadIntent: "moderado",
  primarySkill: "ataque",
  secondarySkill: "passe",
  progressionDimensionTarget: "tomada_decisao",
  pedagogicalIntent: "decision_making",
  recentSkills: ["passe"],
  recentProgressionDimensions: ["consistencia"],
  recentObjectives: [],
  recentPlanHashes: [],
  dominantGapSkill: "passe",
  dominantGapType: "organizacao",
  mustAvoidRepeating: [],
  mustProgressFrom: undefined,
  duration: 60,
  materials: ["bolas"],
  constraints: [],
  allowedDrillFamilies: ["bloco_tecnico"],
  forbiddenDrillFamilies: [],
};

const preMatchContext: TeamPlanningContext = {
  hasUpcomingMatch: true,
  daysUntilMatch: 1,
  planningMode: "pre_match",
  recommendedLoadBias: "reduce",
  focusHints: ["ajuste tático", "organização coletiva", "comunicação"],
  avoidHints: ["fadiga excessiva", "volume desnecessário"],
  reason: "partida em 1 dia; intervenções recentes do professor",
};

describe("adaptGenerationContextWithTeamPlanning", () => {
  test("pre_match reduz carga e prioriza organização coletiva", () => {
    const adapted = adaptGenerationContextWithTeamPlanning({
      generationContext: baseContext,
      teamPlanningContext: preMatchContext,
    });

    expect(adapted.weeklyLoadIntent).toBe("baixo");
    expect(adapted.phaseIntent).toBe("transferencia_jogo");
    expect(adapted.pedagogicalIntent).toBe("team_organization");
    expect(adapted.constraints).toEqual(
      expect.arrayContaining([
        "Contexto competitivo: pré-jogo.",
        "Foco contextual: ajuste tático.",
        "Evitar: fadiga excessiva.",
      ])
    );
    expect(adapted.allowedDrillFamilies).toEqual(
      expect.arrayContaining(["jogo_condicionado", "cooperacao", "alvo_zona"])
    );
  });

  test("post_match prioriza ajuste técnico sem aumentar carga", () => {
    const adapted = adaptGenerationContextWithTeamPlanning({
      generationContext: baseContext,
      teamPlanningContext: {
        ...preMatchContext,
        hasUpcomingMatch: false,
        daysUntilMatch: null,
        planningMode: "post_match",
        recommendedLoadBias: "reduce",
      },
    });

    expect(adapted.phaseIntent).toBe("estabilizacao_tecnica");
    expect(adapted.pedagogicalIntent).toBe("technical_adjustment");
    expect(adapted.weeklyLoadIntent).toBe("baixo");
  });

  test("normal com increase sobe carga de baixo para moderado", () => {
    const adapted = adaptGenerationContextWithTeamPlanning({
      generationContext: { ...baseContext, weeklyLoadIntent: "baixo" },
      teamPlanningContext: {
        ...preMatchContext,
        hasUpcomingMatch: false,
        daysUntilMatch: null,
        planningMode: "normal",
        recommendedLoadBias: "increase",
        focusHints: ["progressão controlada"],
        avoidHints: [],
      },
    });

    expect(adapted.weeklyLoadIntent).toBe("moderado");
  });
});
