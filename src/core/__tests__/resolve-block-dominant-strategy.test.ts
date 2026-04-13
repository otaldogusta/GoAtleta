import { applyDominantBlockStrategy, resolveDominantBlockStrategyProfile } from "../cycle-day-planning/resolve-block-dominant-strategy";
import type { CycleDayPlanningContext, SessionStrategy } from "../models";

const buildContext = (
  overrides: Partial<CycleDayPlanningContext> = {}
): CycleDayPlanningContext => ({
  classId: "class_1",
  sessionDate: "2026-04-10",
  modality: "voleibol",
  classLevel: 2,
  ageBand: "13-15",
  daysPerWeek: 3,
  developmentStage: "especializado",
  planningPhase: "desenvolvimento",
  weekNumber: 5,
  sessionIndexInWeek: 2,
  historicalConfidence: "medium",
  phaseIntent: "estabilizacao_tecnica",
  weeklyLoadIntent: "moderado",
  primarySkill: "passe",
  secondarySkill: "levantamento",
  progressionDimensionTarget: "precisao",
  pedagogicalIntent: "technical_adjustment",
  recentSessions: [],
  dominantBlock: "Base tecnica",
  targetPse: 5,
  duration: 90,
  materials: ["quadra"],
  constraints: [],
  mustAvoidRepeating: [],
  allowedDrillFamilies: ["bloco_tecnico", "alvo_zona", "cooperacao", "jogo_condicionado", "deslocamento"],
  forbiddenDrillFamilies: ["repeticao_estatica_prolongada"],
  ...overrides,
});

const buildStrategy = (overrides: Partial<SessionStrategy> = {}): SessionStrategy => ({
  primarySkill: "ataque",
  secondarySkill: "bloqueio",
  progressionDimension: "oposicao",
  pedagogicalIntent: "pressure_adaptation",
  loadIntent: "moderado",
  drillFamilies: ["deslocamento", "jogo_condicionado"],
  forbiddenDrillFamilies: ["repeticao_estatica_prolongada"],
  oppositionLevel: "medium",
  timePressureLevel: "medium",
  gameTransferLevel: "medium",
  ...overrides,
});

describe("resolve-block-dominant-strategy", () => {
  it("recognizes the supported dominant block profiles", () => {
    expect(resolveDominantBlockStrategyProfile("Base tecnica")?.key).toBe("base_tecnica");
    expect(resolveDominantBlockStrategyProfile("Organizacao ofensiva")?.key).toBe(
      "organizacao_ofensiva"
    );
    expect(resolveDominantBlockStrategyProfile("Aplicacao em jogo")?.key).toBe(
      "aplicacao_em_jogo"
    );
  });

  it("pushes base tecnica toward technical adjustment with lower pressure", () => {
    const result = applyDominantBlockStrategy({
      context: buildContext({ dominantBlock: "Base tecnica", sessionIndexInWeek: 1 }),
      strategy: buildStrategy(),
    });

    expect(result.adjusted).toBe(true);
    expect(result.strategy.primarySkill).toBe("passe");
    expect(result.strategy.progressionDimension).toBe("precisao");
    expect(result.strategy.pedagogicalIntent).toBe("technical_adjustment");
    expect(result.strategy.drillFamilies[0]).toBe("bloco_tecnico");
    expect(result.strategy.gameTransferLevel).toBe("low");
  });

  it("pushes organizacao ofensiva toward team organization and decision demands", () => {
    const result = applyDominantBlockStrategy({
      context: buildContext({
        dominantBlock: "Organizacao ofensiva",
        phaseIntent: "aceleracao_decisao",
      }),
      strategy: buildStrategy({ progressionDimension: "precisao" }),
    });

    expect(result.strategy.primarySkill).toBe("levantamento");
    expect(result.strategy.secondarySkill).toBe("ataque");
    expect(result.strategy.progressionDimension).toBe("tomada_decisao");
    expect(result.strategy.pedagogicalIntent).toBe("team_organization");
    expect(result.strategy.oppositionLevel).toBe("medium");
    expect(result.strategy.drillFamilies[0]).toBe("cooperacao");
  });

  it("pushes aplicacao em jogo toward transfer and higher game pressure", () => {
    const result = applyDominantBlockStrategy({
      context: buildContext({
        dominantBlock: "Aplicacao em jogo",
        phaseIntent: "transferencia_jogo",
      }),
      strategy: buildStrategy({
        progressionDimension: "tomada_decisao",
        pedagogicalIntent: "team_organization",
      }),
    });

    expect(result.strategy.primarySkill).toBe("transicao");
    expect(result.strategy.progressionDimension).toBe("transferencia_jogo");
    expect(result.strategy.pedagogicalIntent).toBe("game_reading");
    expect(result.strategy.oppositionLevel).toBe("high");
    expect(result.strategy.timePressureLevel).toBe("high");
    expect(result.strategy.gameTransferLevel).toBe("high");
    expect(result.strategy.drillFamilies[0]).toBe("jogo_condicionado");
  });
});
