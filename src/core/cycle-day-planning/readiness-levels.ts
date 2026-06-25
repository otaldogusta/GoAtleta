import type { GameFormatLevel, StrategyLevel } from "../models";

export const GAME_FORMAT_LEVELS: GameFormatLevel[] = [
  "L0_onboarding",
  "L1_controle_individual",
  "L2_1x1_facilitado",
  "L3_1x1_intencional",
  "L4_2x2_cooperativo",
  "L5_2x2_decisao",
  "L6_3x3_introdutorio",
  "L7_3x3_organizado",
  "L8_festival_aplicado",
];

const STRATEGY_LEVELS: StrategyLevel[] = ["low", "medium", "high"];

export const getGameFormatLevelRank = (level: GameFormatLevel) => {
  const index = GAME_FORMAT_LEVELS.indexOf(level);
  return index >= 0 ? index : 0;
};

export const getGameFormatLevelAtRank = (rank: number): GameFormatLevel =>
  GAME_FORMAT_LEVELS[Math.min(Math.max(Math.round(rank), 0), GAME_FORMAT_LEVELS.length - 1)] ??
  "L0_onboarding";

export const minGameFormatLevel = (
  left: GameFormatLevel,
  right: GameFormatLevel
): GameFormatLevel =>
  getGameFormatLevelRank(left) <= getGameFormatLevelRank(right) ? left : right;

export const shiftGameFormatLevel = (
  level: GameFormatLevel,
  delta: number
): GameFormatLevel => getGameFormatLevelAtRank(getGameFormatLevelRank(level) + delta);

export const compareGameFormatLevels = (
  left: GameFormatLevel,
  right: GameFormatLevel
) => getGameFormatLevelRank(left) - getGameFormatLevelRank(right);

export const minStrategyLevel = (
  left: StrategyLevel,
  right: StrategyLevel
): StrategyLevel => {
  const leftIndex = STRATEGY_LEVELS.indexOf(left);
  const rightIndex = STRATEGY_LEVELS.indexOf(right);
  if (leftIndex < 0 || rightIndex < 0) return left;
  return STRATEGY_LEVELS[Math.min(leftIndex, rightIndex)] ?? left;
};

export const mapGameFormatLevelToStrategyComplexity = (
  level: GameFormatLevel
): {
  oppositionLevel: StrategyLevel;
  timePressureLevel: StrategyLevel;
  gameTransferLevel: StrategyLevel;
} => {
  switch (level) {
    case "L0_onboarding":
    case "L1_controle_individual":
      return {
        oppositionLevel: "low",
        timePressureLevel: "low",
        gameTransferLevel: "low",
      };
    case "L2_1x1_facilitado":
      return {
        oppositionLevel: "low",
        timePressureLevel: "low",
        gameTransferLevel: "medium",
      };
    case "L3_1x1_intencional":
      return {
        oppositionLevel: "low",
        timePressureLevel: "medium",
        gameTransferLevel: "medium",
      };
    case "L4_2x2_cooperativo":
      return {
        oppositionLevel: "medium",
        timePressureLevel: "medium",
        gameTransferLevel: "medium",
      };
    case "L5_2x2_decisao":
      return {
        oppositionLevel: "medium",
        timePressureLevel: "high",
        gameTransferLevel: "medium",
      };
    case "L6_3x3_introdutorio":
      return {
        oppositionLevel: "high",
        timePressureLevel: "medium",
        gameTransferLevel: "high",
      };
    case "L7_3x3_organizado":
    case "L8_festival_aplicado":
      return {
        oppositionLevel: "high",
        timePressureLevel: "high",
        gameTransferLevel: "high",
      };
    default:
      return {
        oppositionLevel: "low",
        timePressureLevel: "low",
        gameTransferLevel: "low",
      };
  }
};

export const formatGameFormatLevelTitle = (level: GameFormatLevel) => {
  switch (level) {
    case "L0_onboarding":
      return "Entrada";
    case "L1_controle_individual":
      return "Controle individual";
    case "L2_1x1_facilitado":
      return "1x1 facilitado";
    case "L3_1x1_intencional":
      return "1x1 com intenção";
    case "L4_2x2_cooperativo":
      return "2x2 cooperativo";
    case "L5_2x2_decisao":
      return "2x2 com decisão";
    case "L6_3x3_introdutorio":
      return "3x3 introdutório";
    case "L7_3x3_organizado":
      return "3x3 organizado";
    case "L8_festival_aplicado":
      return "Festival aplicado";
    default:
      return "Aula ajustada";
  }
};
