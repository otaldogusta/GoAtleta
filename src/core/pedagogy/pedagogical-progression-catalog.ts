// ─────────────────────────────────────────────────────────────────────────────
// Catálogo canônico de progressão pedagógica do voleibol
//
// Cada stage mapeia:
//   ageBand (canônico) → mês → sequência dentro do mês
//   → forma de jogo → skills já introduzidas / contextos já praticados
//   → próximo passo → restrições pedagógicas → blocos recomendados
//   → fonte metodológica rastreável
//
// Regra: nenhum termo estrangeiro (toetsen, cmv niveau, etc.) pode aparecer
// aqui. Use a source.sourceRef apenas para rastreabilidade interna.
// ─────────────────────────────────────────────────────────────────────────────

import type { PedagogicalProgressionStage } from "./pedagogical-types";

export const PEDAGOGICAL_PROGRESSION_CATALOG: PedagogicalProgressionStage[] = [
  // ─── 08-10 — MINI 2x2 ─────────────────────────────────────────────────────

  // Janeiro — sequência 1: controle inicial
  {
    id: "08-10_jan_01",
    ageBand: "08-10",
    monthIndex: 1,
    sequenceIndex: 1,
    phase: "exploracao_motora",
    stageLabel: "controle inicial e familiarização com a bola",
    gameForm: "mini_2x2",
    complexityLevel: "baixo",
    alreadyIntroduced: ["throw_catch_control"],
    alreadyPracticedContexts: ["free_space", "individual_control"],
    nextStep: ["set_self_control", "mini_game_1x1_intro"],
    pedagogicalConstraints: [
      "usar linguagem concreta e direta",
      "priorizar ludicidade sobre técnica",
      "não usar leitura tática abstrata",
      "manter organização simples: duplas ou livre",
    ],
    blockRecommendations: {
      warmup: ["throw_catch_control"],
      main: ["set_self_control", "mini_game_1x1_intro"],
      cooldown: ["mini_game_1x1_intro"],
    },
    source: {
      methodology: "rede_esperanca",
      sourceLabel: "Rede Esperança — janeiro",
      sourceRef: "coordenação, brincadeiras com bola, toque inicial e mini vôlei 1x1",
    },
  },

  // Janeiro — sequência 2: toque e saque introdutório
  {
    id: "08-10_jan_02",
    ageBand: "08-10",
    monthIndex: 1,
    sequenceIndex: 2,
    phase: "exploracao_motora",
    stageLabel: "toque inicial e saque por baixo adaptado",
    gameForm: "mini_2x2",
    complexityLevel: "baixo",
    alreadyIntroduced: ["throw_catch_control", "set_self_control"],
    alreadyPracticedContexts: ["free_space", "pair_work", "adapted_rules"],
    nextStep: ["underhand_serve_intro", "set_target_simple"],
    pedagogicalConstraints: [
      "usar alvo simples (cone ou marca no chão)",
      "organizar em duplas ou trios",
      "não exigir continuidade longa ainda",
    ],
    blockRecommendations: {
      warmup: ["throw_catch_control", "set_self_control"],
      main: ["underhand_serve_intro", "set_target_simple"],
      cooldown: ["mini_game_1x1_intro"],
    },
    source: {
      methodology: "instituto_compartilhar",
      sourceLabel: "Mini 2x2 — Compartilhar",
      sourceRef: "estruturação inicial dos fundamentos e construção do jogo",
    },
  },

  // Fevereiro — sequência 1: fundamentos com continuidade
  {
    id: "08-10_feb_01",
    ageBand: "08-10",
    monthIndex: 2,
    sequenceIndex: 1,
    phase: "fundamentos_basicos",
    stageLabel: "fundamentos básicos com continuidade inicial",
    gameForm: "mini_2x2",
    complexityLevel: "baixo_moderado",
    alreadyIntroduced: [
      "throw_catch_control",
      "set_self_control",
      "underhand_serve_intro",
      "mini_game_1x1_intro",
    ],
    alreadyPracticedContexts: ["pair_work", "simple_target", "adapted_rules", "reduced_court"],
    nextStep: ["receive_simple", "two_action_continuity", "mini_game_2x2_intro"],
    pedagogicalConstraints: [
      "priorizar jogo reduzido com regras simples",
      "usar tarefas curtas com objetivo claro",
      "falar em 'bola para o colega' e 'continuidade', não em função tática",
      "não usar levantadora fixa como papel central",
    ],
    blockRecommendations: {
      warmup: ["set_self_control", "receive_simple"],
      main: ["two_action_continuity", "mini_game_2x2_intro"],
      cooldown: ["mini_game_2x2_intro"],
    },
    source: {
      methodology: "rede_esperanca",
      sourceLabel: "Rede Esperança — fevereiro",
      sourceRef: "fundamentos básicos, rally curto, continuidade e jogos adaptados",
    },
  },

  // Fevereiro — sequência 2: direcionamento simples
  {
    id: "08-10_feb_02",
    ageBand: "08-10",
    monthIndex: 2,
    sequenceIndex: 2,
    phase: "fundamentos_basicos",
    stageLabel: "direcionamento simples e continuidade com 2 ações",
    gameForm: "mini_2x2",
    complexityLevel: "baixo_moderado",
    alreadyIntroduced: ["receive_simple", "two_action_continuity", "mini_game_2x2_intro"],
    alreadyPracticedContexts: ["pair_work", "simple_target", "continuity_game", "adapted_rules"],
    nextStep: ["receive_direction", "set_target_simple", "mini_game_2x2_continuity"],
    pedagogicalConstraints: [
      "usar alvo simples antes de pedir direcionamento livre",
      "não subir para sequência de 3 ações completas ainda",
      "manter feedback curto e positivo",
    ],
    blockRecommendations: {
      warmup: ["receive_simple", "set_target_simple"],
      main: ["receive_direction", "mini_game_2x2_continuity"],
      cooldown: ["mini_game_2x2_continuity"],
    },
    source: {
      methodology: "cmv_nederland",
      sourceLabel: "CMV 8-10",
      sourceRef: "toque, saque, continuidade e 3 keer spelen no fechamento do ciclo",
    },
  },

  // Março — sequência 1: 2 a 3 ações com organização
  {
    id: "08-10_mar_01",
    ageBand: "08-10",
    monthIndex: 3,
    sequenceIndex: 1,
    phase: "consolidacao_ludica",
    stageLabel: "continuidade com 2 a 3 ações e mais organização",
    gameForm: "mini_2x2",
    complexityLevel: "moderado",
    alreadyIntroduced: ["receive_direction", "set_target_simple", "mini_game_2x2_continuity"],
    alreadyPracticedContexts: ["continuity_game", "application_game", "reduced_court"],
    nextStep: ["lift_front_intro", "three_action_continuity"],
    pedagogicalConstraints: [
      "manter linguagem simples e concreta",
      "não usar leitura tática avançada",
      "priorizar sequência com ajuda do colega antes de exigir autonomia",
    ],
    blockRecommendations: {
      warmup: ["set_with_movement", "receive_direction"],
      main: ["lift_front_intro", "three_action_continuity"],
      cooldown: ["mini_game_2x2_continuity"],
    },
    source: {
      methodology: "rede_esperanca",
      sourceLabel: "Rede Esperança — março",
      sourceRef: "2 a 3 ações, recepção, levantamento à frente e devolução com controle",
    },
  },

  // ─── 11-12 — MINI 3x3 ─────────────────────────────────────────────────────

  {
    id: "11-12_intro_01",
    ageBand: "11-12",
    monthIndex: 1,
    sequenceIndex: 1,
    phase: "estruturacao_e_evolucao",
    stageLabel: "mini 3x3 e aumento de complexidade técnica",
    gameForm: "mini_3x3",
    complexityLevel: "moderado",
    alreadyIntroduced: [
      "underhand_serve_target",
      "set_continuity",
      "mini_game_2x2_continuity",
    ],
    alreadyPracticedContexts: ["trio_work", "continuity_game", "application_game"],
    nextStep: [
      "mini_game_3x3_intro",
      "defense_control_intro",
      "coverage_intro",
      "attack_arm_intro",
      "block_marking_intro",
    ],
    pedagogicalConstraints: [
      "aumentar cooperação e organização do grupo",
      "manter progressão técnica sem virar jogo formal completo",
      "usar regras adaptadas para estimular fundamentos específicos",
    ],
    blockRecommendations: {
      warmup: ["set_with_movement", "receive_direction"],
      main: ["mini_game_3x3_intro", "defense_control_intro", "coverage_intro"],
      cooldown: ["mini_game_3x3_intro"],
    },
    source: {
      methodology: "instituto_compartilhar",
      sourceLabel: "Mini 3x3 — Compartilhar",
      sourceRef: "11–12 anos, evolução dos fundamentos, cooperação e organização do jogo",
    },
  },

  // ─── 13-14 — MINI 4x4 ─────────────────────────────────────────────────────

  {
    id: "13-14_intro_01",
    ageBand: "13-14",
    monthIndex: 1,
    sequenceIndex: 1,
    phase: "transicao_para_o_jogo_formal",
    stageLabel: "mini 4x4 como ponte para o voleibol formal",
    gameForm: "mini_4x4",
    complexityLevel: "moderado_alto",
    alreadyIntroduced: ["mini_game_3x3_intro", "defense_control_intro", "coverage_intro"],
    alreadyPracticedContexts: ["application_game", "trio_work", "reduced_court"],
    nextStep: ["three_action_continuity"],
    pedagogicalConstraints: [
      "tratar como transição — não é ainda 6x6 formal",
      "não pular direto para o jogo completo sem preparação da sequência de 3 contatos",
    ],
    blockRecommendations: {
      warmup: ["receive_direction", "set_continuity"],
      main: ["three_action_continuity"],
      cooldown: ["mini_game_3x3_intro"],
    },
    source: {
      methodology: "instituto_compartilhar",
      sourceLabel: "Mini 4x4 — Compartilhar",
      sourceRef: "transição entre mini 3x3 e vôlei formal, 13 anos",
    },
  },
];
