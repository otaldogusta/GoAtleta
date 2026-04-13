import { applyLoadModulation, resolveLoadModulationProfile } from "../cycle-day-planning/resolve-load-modulation";
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
  targetPse: 5,
  demandIndex: 6,
  plannedSessionLoad: 450,
  plannedWeeklyLoad: 1350,
  duration: 90,
  materials: ["quadra"],
  constraints: [],
  mustAvoidRepeating: [],
  allowedDrillFamilies: ["bloco_tecnico", "alvo_zona", "cooperacao", "deslocamento", "jogo_condicionado"],
  forbiddenDrillFamilies: ["repeticao_estatica_prolongada"],
  ...overrides,
});

const buildStrategy = (overrides: Partial<SessionStrategy> = {}): SessionStrategy => ({
  primarySkill: "passe",
  secondarySkill: "levantamento",
  progressionDimension: "precisao",
  pedagogicalIntent: "technical_adjustment",
  loadIntent: "moderado",
  drillFamilies: ["bloco_tecnico", "cooperacao"],
  forbiddenDrillFamilies: ["repeticao_estatica_prolongada"],
  oppositionLevel: "medium",
  timePressureLevel: "medium",
  gameTransferLevel: "low",
  ...overrides,
});

describe("resolve-load-modulation", () => {
  it("recognizes a recovery profile from low PSE, low demand, and low planned load", () => {
    const profile = resolveLoadModulationProfile(
      buildContext({
        weeklyLoadIntent: "baixo",
        targetPse: 4,
        demandIndex: 3,
        plannedSessionLoad: 320,
      })
    );

    expect(profile.key).toBe("recovery");
    expect(profile.label).toBe("Carga regenerativa");
  });

  it("recognizes an intensive profile from high PSE, high demand, and high planned load", () => {
    const profile = resolveLoadModulationProfile(
      buildContext({
        weeklyLoadIntent: "alto",
        targetPse: 7,
        demandIndex: 8,
        plannedSessionLoad: 630,
      })
    );

    expect(profile.key).toBe("intensive");
    expect(profile.label).toBe("Carga intensiva");
  });

  it("reduces pressure and shifts family priority under recovery modulation", () => {
    const result = applyLoadModulation({
      context: buildContext({
        weeklyLoadIntent: "baixo",
        targetPse: 4,
        demandIndex: 3,
        plannedSessionLoad: 320,
      }),
      strategy: buildStrategy({
        progressionDimension: "oposicao",
        drillFamilies: ["deslocamento", "jogo_condicionado"],
        oppositionLevel: "high",
        timePressureLevel: "high",
        gameTransferLevel: "medium",
      }),
    });

    expect(result.adjusted).toBe(true);
    expect(result.strategy.loadIntent).toBe("baixo");
    expect(result.strategy.progressionDimension).toBe("pressao_tempo");
    expect(result.strategy.oppositionLevel).toBe("medium");
    expect(result.strategy.drillFamilies[0]).toBe("bloco_tecnico");
  });

  it("raises pressure and game transfer under intensive modulation", () => {
    const result = applyLoadModulation({
      context: buildContext({
        weeklyLoadIntent: "alto",
        targetPse: 7,
        demandIndex: 8,
        plannedSessionLoad: 630,
      }),
      strategy: buildStrategy({
        progressionDimension: "precisao",
        drillFamilies: ["bloco_tecnico", "cooperacao"],
        oppositionLevel: "medium",
        timePressureLevel: "medium",
        gameTransferLevel: "medium",
      }),
    });

    expect(result.adjusted).toBe(true);
    expect(result.strategy.loadIntent).toBe("alto");
    expect(result.strategy.progressionDimension).toBe("pressao_tempo");
    expect(result.strategy.timePressureLevel).toBe("high");
    expect(result.strategy.drillFamilies[0]).toBe("deslocamento");
  });
});
