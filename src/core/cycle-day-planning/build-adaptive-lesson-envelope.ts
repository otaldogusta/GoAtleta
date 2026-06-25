import type { AdaptiveLessonEnvelope, ClassReadinessState, GameFormatLevel, SessionStrategy } from "../models";
import {
  formatGameFormatLevelTitle,
  minGameFormatLevel,
  shiftGameFormatLevel,
} from "./readiness-levels";

const levelIntent = (level: GameFormatLevel) => {
  switch (level) {
    case "L0_onboarding":
    case "L1_controle_individual":
      return "controle individual com bola, alvo grande e poucas regras";
    case "L2_1x1_facilitado":
      return "1x1 com quique, alvo e tempo para organizar o contato";
    case "L3_1x1_intencional":
      return "1x1 com chamada da bola e direção para zona combinada";
    case "L4_2x2_cooperativo":
      return "2x2 cooperativo com comunicação e ajuda do colega";
    case "L5_2x2_decisao":
      return "2x2 com escolha de espaço e continuidade da jogada";
    case "L6_3x3_introdutorio":
      return "3x3 introdutório com regra simples e apoio do professor";
    case "L7_3x3_organizado":
      return "3x3 organizado com recepção, levantamento e devolução";
    case "L8_festival_aplicado":
      return "festival em jogos curtos com rodízio simples";
    default:
      return "aula ajustada para o nível da turma";
  }
};

const levelConstraint = (level: GameFormatLevel) => {
  switch (level) {
    case "L0_onboarding":
    case "L1_controle_individual":
      return "Use lançamento, pegada permitida e alvo grande.";
    case "L2_1x1_facilitado":
    case "L3_1x1_intencional":
      return "Permita quique e mantenha a regra de chamar a bola.";
    case "L4_2x2_cooperativo":
    case "L5_2x2_decisao":
      return "Use duplas, zona combinada e ponto por comunicação.";
    case "L6_3x3_introdutorio":
    case "L7_3x3_organizado":
      return "Use 3x3 com regra visível e pausas curtas.";
    case "L8_festival_aplicado":
      return "Use jogos curtos, rodízio simples e pontuação por participação.";
    default:
      return "Mantenha regra simples e feedback curto.";
  }
};

export const buildAdaptiveLessonEnvelope = (params: {
  readinessState: ClassReadinessState;
  strategy: SessionStrategy;
}): AdaptiveLessonEnvelope => {
  const applied = params.readinessState.appliedCoreLevel;
  const regression = shiftGameFormatLevel(applied, -1);
  const progression = minGameFormatLevel(
    params.readinessState.plannedGameLevel,
    shiftGameFormatLevel(applied, 1)
  );

  return {
    periodizationTarget: params.readinessState.plannedGameLevel,
    appliedCoreLevel: applied,
    diagnosticProbe: {
      title: `Comece por ${formatGameFormatLevelTitle(regression)}`,
      description: `Use ${levelIntent(regression)} para observar comunicação, controle e continuidade.`,
      decisionRule: "Mantenha o plano base se a turma errar no primeiro contato; avance quando a maioria sustentar a tarefa.",
    },
    planARegression: {
      level: regression,
      intent: levelIntent(regression),
      suggestedConstraint: levelConstraint(regression),
    },
    planBCore: {
      level: applied,
      intent: levelIntent(applied),
      suggestedConstraint: levelConstraint(applied),
    },
    planCProgression: {
      level: progression,
      intent: levelIntent(progression),
      suggestedConstraint: levelConstraint(progression),
    },
  };
};
