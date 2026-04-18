// ─────────────────────────────────────────────────────────────────────────────
// Léxico oficial de linguagem do vôlei para o GoAtleta
//
// Este arquivo é a única fonte de verdade para a tradução de conceitos
// canônicos para a linguagem exibida ao professor, na UI, no PDF e
// no planejamento diário. Nenhum texto estrangeiro ou jargão técnico
// interno deve passar por aqui para a camada de exibição.
// ─────────────────────────────────────────────────────────────────────────────

import type {
    AgeBandKey,
    CanonicalContextKey,
    CanonicalSkillKey,
    GameFormKey,
} from "./pedagogical-types";

// Termos que nunca devem aparecer na UI ou no texto da aula gerada
export const FORBIDDEN_UI_TERMS: string[] = [
  "toetsen",
  "cmv niveau",
  "level 1",
  "level 2",
  "level 3",
  "level 4",
  "execution quality",
  "context reading",
  "best response",
  "keer spelen",
  "schoolvolleybal",
];

// Mapeamento de aliases estrangeiros para chaves canônicas
export const FOREIGN_SOURCE_ALIASES: Record<string, CanonicalSkillKey | CanonicalContextKey | GameFormKey> = {
  "toetsen level 1": "set_self_control",
  "toetsen level 2": "set_target_simple",
  "toetsen level 3": "set_with_movement",
  "toetsen level 4": "set_continuity",
  "cmv niveau 1": "mini_game_1x1_intro",
  "cmv niveau 2": "mini_game_2x2_intro",
  "cmv niveau 3": "mini_game_2x2_continuity",
};

// Rótulos de exibição para cada skill canônica
export const SKILL_DISPLAY_LABELS: Record<CanonicalSkillKey, string> = {
  throw_catch_control: "lançar e pegar com controle",
  set_self_control: "toque para cima",
  set_target_simple: "toque para alvo simples",
  set_with_movement: "toque com deslocamento",
  set_continuity: "toque em continuidade",
  underhand_serve_intro: "saque por baixo adaptado",
  underhand_serve_target: "saque por baixo com alvo",
  receive_simple: "recepção simples",
  receive_direction: "recepção com direcionamento",
  lift_front_intro: "levantamento à frente",
  two_action_continuity: "continuidade com 2 ações",
  three_action_continuity: "continuidade com 3 ações",
  mini_game_1x1_intro: "mini jogo 1x1 adaptado",
  mini_game_2x2_intro: "mini jogo 2x2 adaptado",
  mini_game_2x2_continuity: "mini jogo 2x2 com continuidade",
  mini_game_3x3_intro: "mini jogo 3x3 inicial",
  defense_control_intro: "controle defensivo inicial",
  coverage_intro: "cobertura inicial",
  attack_arm_intro: "iniciação ao ataque",
  block_marking_intro: "marcação inicial de bloqueio",
};

// Rótulos de exibição para cada contexto canônico
export const CONTEXT_DISPLAY_LABELS: Record<CanonicalContextKey, string> = {
  free_space: "espaço livre",
  individual_control: "controle individual",
  pair_work: "duplas",
  trio_work: "trios",
  simple_target: "alvo simples",
  wall_work: "parede",
  reduced_court: "quadra reduzida",
  adapted_rules: "regras adaptadas",
  continuity_game: "jogo de continuidade",
  application_game: "jogo de aplicação",
};

// Rótulos de exibição para cada forma de jogo
export const GAME_FORM_DISPLAY_LABELS: Record<GameFormKey, string> = {
  mini_2x2: "Mini 2x2",
  mini_3x3: "Mini 3x3",
  mini_4x4: "Mini 4x4",
  formal_6x6: "Vôlei 6x6",
};

export function getDisplayLabelForSkill(skill: CanonicalSkillKey): string {
  return SKILL_DISPLAY_LABELS[skill];
}

export function getDisplayLabelForContext(context: CanonicalContextKey): string {
  return CONTEXT_DISPLAY_LABELS[context];
}

export function getDisplayLabelForGameForm(gameForm: GameFormKey): string {
  return GAME_FORM_DISPLAY_LABELS[gameForm];
}

// Remove termos proibidos de um texto antes de exibir ao professor
export function sanitizeVolleyballLanguage(text: string): string {
  let result = text;
  for (const term of FORBIDDEN_UI_TERMS) {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    result = result.replace(regex, "");
  }
  return result
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

// Perfil de linguagem da faixa etária — controla abstração e estilo de frase
export function getAgeBandLanguageStyle(ageBand: AgeBandKey) {
  if (ageBand === "06-07" || ageBand === "08-10") {
    return {
      avoidAbstraction: true,
      preferConcreteActions: true,
      preferGameLanguage: true,
      maxSentencesPerBlock: 2,
    };
  }
  return {
    avoidAbstraction: false,
    preferConcreteActions: true,
    preferGameLanguage: true,
    maxSentencesPerBlock: 3,
  };
}
