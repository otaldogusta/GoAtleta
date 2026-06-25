import type { ClassReadinessState, GameFormatLevel, SessionStrategy } from "../models";
import {
  getGameFormatLevelRank,
  mapGameFormatLevelToStrategyComplexity,
  minStrategyLevel,
} from "./readiness-levels";

const normalizeFamilies = (families: string[]) => [...new Set(families.filter(Boolean))];

const restrictDrillFamiliesByGameLevel = (
  drillFamilies: string[],
  appliedCoreLevel: GameFormatLevel
) => {
  const rank = getGameFormatLevelRank(appliedCoreLevel);
  const families = normalizeFamilies(drillFamilies);

  if (rank <= getGameFormatLevelRank("L3_1x1_intencional")) {
    const preferred = families.filter((family) =>
      ["bloco_tecnico", "alvo_zona", "cooperacao"].includes(family)
    );
    return preferred.length ? preferred : ["alvo_zona", "cooperacao"];
  }

  if (rank <= getGameFormatLevelRank("L5_2x2_decisao")) {
    const preferred = families.filter((family) =>
      ["cooperacao", "jogo_condicionado", "alvo_zona", "deslocamento", "bloco_tecnico"].includes(family)
    );
    return preferred.length ? preferred : ["cooperacao", "jogo_condicionado"];
  }

  return families.length ? families : ["jogo_condicionado", "cooperacao"];
};

export const applyReadinessGuardToSessionStrategy = (params: {
  strategy: SessionStrategy;
  readinessState: ClassReadinessState;
}): SessionStrategy => {
  const complexity = mapGameFormatLevelToStrategyComplexity(params.readinessState.appliedCoreLevel);

  return {
    ...params.strategy,
    oppositionLevel: minStrategyLevel(params.strategy.oppositionLevel, complexity.oppositionLevel),
    timePressureLevel: minStrategyLevel(params.strategy.timePressureLevel, complexity.timePressureLevel),
    gameTransferLevel: minStrategyLevel(params.strategy.gameTransferLevel, complexity.gameTransferLevel),
    drillFamilies: restrictDrillFamiliesByGameLevel(
      params.strategy.drillFamilies,
      params.readinessState.appliedCoreLevel
    ),
  };
};
