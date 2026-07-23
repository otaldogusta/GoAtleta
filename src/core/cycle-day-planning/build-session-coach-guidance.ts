import type {
  AdaptiveLessonEnvelope,
  ClassGroup,
  ClassReadinessState,
  SessionCoachGuidance,
} from "../models";
import {
  formatGameFormatLevelTitle,
  getGameFormatLevelRank,
} from "./readiness-levels";

const uniqueStrings = (values: (string | null | undefined)[]) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const isBridgeTo2x2 = (readiness: ClassReadinessState) =>
  getGameFormatLevelRank(readiness.plannedGameLevel) >= getGameFormatLevelRank("L6_3x3_introdutorio") &&
  getGameFormatLevelRank(readiness.appliedCoreLevel) <= getGameFormatLevelRank("L4_2x2_cooperativo");

const titleFor = (readiness: ClassReadinessState) => {
  if (isBridgeTo2x2(readiness)) return "Ponte 1x1 -> 2x2";
  return formatGameFormatLevelTitle(readiness.appliedCoreLevel);
};

const subtitleFor = (readiness: ClassReadinessState) => {
  if (isBridgeTo2x2(readiness)) {
    return "Prepare a organização do 3x3 sem pular etapas.";
  }
  if (readiness.riskFlags.includes("alunos_novos")) {
    return "Organize entrada guiada e mantenha todos em atividade.";
  }
  return "Mantenha a aula no maior desafio seguro de hoje.";
};

const baseDoNow = (readiness: ClassReadinessState) => {
  if (isBridgeTo2x2(readiness)) {
    return [
      "Comece com 1x1 com quique e alvo.",
      "Use chamada obrigatória da bola: \"minha\".",
      "Passe para 2x2 cooperativo no bloco principal.",
      "Finalize com jogo curto em duplas.",
    ];
  }

  const rank = getGameFormatLevelRank(readiness.appliedCoreLevel);
  if (rank <= getGameFormatLevelRank("L3_1x1_intencional")) {
    return [
      "Comece com controle individual e alvo grande.",
      "Use 1x1 com quique antes de tirar a adaptação.",
      "Peça chamada da bola antes do contato.",
      "Mantenha rodadas curtas com feedback imediato.",
    ];
  }

  if (rank <= getGameFormatLevelRank("L5_2x2_decisao")) {
    return [
      "Monte duplas fixas por rodada.",
      "Use 2x2 cooperativo com zona combinada.",
      "Pontue comunicação e continuidade da bola.",
      "Troque duplas apenas ao fim da rodada.",
    ];
  }

  return [
    "Retome comunicação obrigatória.",
    "Use recepção para alvo.",
    "Organize recepção, levantamento e devolução.",
    "Termine com 3x3 com regra simples.",
  ];
};

const baseAvoid = (readiness: ClassReadinessState) => {
  const items = [
    isBridgeTo2x2(readiness) ? "Evite 3x3 livre no começo." : null,
    "Evite rodízio complexo.",
    "Evite corrigir tudo ao mesmo tempo.",
    "Evite muitos comandos técnicos durante o jogo.",
    readiness.riskFlags.includes("alunos_novos") ? "Evite colocar novos alunos direto no jogo livre." : null,
  ];
  return items;
};

const baseAdvanceIf = (readiness: ClassReadinessState) => {
  if (isBridgeTo2x2(readiness)) {
    return [
      "A maioria mantiver 3 trocas no 1x1.",
      "As duplas chamarem a bola antes do contato.",
      "Os alunos direcionarem a bola para uma zona combinada.",
    ];
  }

  return [
    "A maioria sustentar a tarefa sem parar a rodada.",
    "Os alunos chamarem a bola antes do contato.",
    "A bola for direcionada com intenção.",
  ];
};

const baseSimplifyIf = (readiness: ClassReadinessState) => [
  "A bola cair no primeiro contato.",
  "Os alunos ficarem parados esperando.",
  readiness.riskFlags.includes("alunos_novos")
    ? "Os novos alunos não entenderem a regra."
    : "A comunicação desaparecer durante o jogo.",
];

export const buildSessionCoachGuidance = (input: {
  readinessState: ClassReadinessState;
  adaptiveEnvelope: AdaptiveLessonEnvelope;
  classGroup: ClassGroup;
}): SessionCoachGuidance => {
  const setupHint = input.readinessState.riskFlags.includes("alunos_novos") ||
    input.readinessState.riskFlags.includes("turma_heterogenea")
    ? "Monte estações por nível: entrada com alvo, 1x1 com quique e 2x2 cooperativo."
    : input.adaptiveEnvelope.planBCore.suggestedConstraint;

  return {
    title: titleFor(input.readinessState),
    subtitle: subtitleFor(input.readinessState),
    doNow: uniqueStrings(baseDoNow(input.readinessState)).slice(0, 4),
    avoidToday: uniqueStrings(baseAvoid(input.readinessState)).slice(0, 4),
    advanceIf: uniqueStrings(baseAdvanceIf(input.readinessState)).slice(0, 4),
    simplifyIf: uniqueStrings(baseSimplifyIf(input.readinessState)).slice(0, 4),
    setupHint,
    closingCue: "Pergunte: o que ajudou a turma a manter a bola em jogo?",
  };
};
