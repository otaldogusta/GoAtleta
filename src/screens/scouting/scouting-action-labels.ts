import type { ScoutingActionQuality, ScoutingActionSkill, ScoutingActionScore } from "../../core/scouting-action";

export type ScoutingQualityOption = {
  actionType: string;
  id: string;
  label: string;
  quality: ScoutingActionQuality;
  score: ScoutingActionScore;
};

const DEFAULT_OPTIONS: Record<ScoutingActionSkill, ScoutingQualityOption[]> = {
  serve: [
    { id: "error", label: "Erro", quality: "error", score: 0, actionType: "error" },
    { id: "in_play", label: "Entrou", quality: "low", score: 1, actionType: "in_play" },
    { id: "difficult", label: "Dificultou", quality: "medium", score: 2, actionType: "difficult" },
    { id: "ace", label: "Ace", quality: "excellent", score: 3, actionType: "ace" },
  ],
  receive: [
    { id: "error", label: "Erro", quality: "error", score: 0, actionType: "error" },
    { id: "pass_c", label: "C / Baixo", quality: "low", score: 1, actionType: "pass_c" },
    { id: "pass_b", label: "B / Médio", quality: "medium", score: 2, actionType: "pass_b" },
    { id: "pass_a", label: "A / Alto", quality: "high", score: 3, actionType: "pass_a" },
  ],
  set: [
    { id: "error", label: "Erro", quality: "error", score: 0, actionType: "error" },
    { id: "out_of_system", label: "Fora do sistema", quality: "low", score: 1, actionType: "out_of_system" },
    { id: "playable", label: "Jogável", quality: "medium", score: 2, actionType: "playable" },
    { id: "excellent_set", label: "Excelente", quality: "excellent", score: 3, actionType: "excellent_set" },
  ],
  attack: [
    { id: "error", label: "Erro", quality: "error", score: 0, actionType: "error" },
    { id: "continuation", label: "Continuidade", quality: "low", score: 1, actionType: "continuation" },
    { id: "blocked", label: "Bloqueado", quality: "medium", score: 2, actionType: "blocked" },
    { id: "kill", label: "Ponto", quality: "excellent", score: 3, actionType: "kill" },
  ],
  block: [
    { id: "error", label: "Erro", quality: "error", score: 0, actionType: "error" },
    { id: "touch", label: "Tocou", quality: "low", score: 1, actionType: "touch" },
    { id: "soft_block", label: "Amorteceu", quality: "medium", score: 2, actionType: "soft_block" },
    { id: "block_point", label: "Ponto", quality: "excellent", score: 3, actionType: "block_point" },
  ],
  defense: [
    { id: "missed", label: "Não defendeu", quality: "error", score: 0, actionType: "missed" },
    { id: "kept_alive", label: "Manteve viva", quality: "medium", score: 2, actionType: "kept_alive" },
    { id: "good_dig", label: "Defesa boa", quality: "high", score: 3, actionType: "good_dig" },
    { id: "counterattack", label: "Contra-ataque", quality: "excellent", score: 3, actionType: "counterattack" },
  ],
  coverage: [
    { id: "absent", label: "Ausente", quality: "error", score: 0, actionType: "absent" },
    { id: "late", label: "Atrasada", quality: "low", score: 1, actionType: "late" },
    { id: "kept_alive", label: "Manteve viva", quality: "medium", score: 2, actionType: "kept_alive" },
    { id: "counterattack", label: "Contra-ataque", quality: "excellent", score: 3, actionType: "counterattack" },
  ],
  transition: [
    { id: "slow", label: "Lenta", quality: "low", score: 1, actionType: "slow" },
    { id: "organized", label: "Organizada", quality: "medium", score: 2, actionType: "organized" },
    { id: "fast", label: "Rápida", quality: "high", score: 3, actionType: "fast" },
    { id: "point", label: "Ponto", quality: "excellent", score: 3, actionType: "point" },
  ],
  communication: [
    { id: "absent", label: "Ausente", quality: "error", score: 0, actionType: "absent" },
    { id: "late", label: "Tardia", quality: "low", score: 1, actionType: "late" },
    { id: "clear", label: "Clara", quality: "high", score: 3, actionType: "clear" },
    { id: "led_action", label: "Liderou ação", quality: "excellent", score: 3, actionType: "led_action" },
  ],
};

const SKILL_LABELS: Record<ScoutingActionSkill, string> = {
  serve: "Saque",
  receive: "Recepção",
  set: "Levantamento",
  attack: "Ataque",
  block: "Bloqueio",
  defense: "Defesa",
  coverage: "Cobertura",
  transition: "Transição",
  communication: "Comunicação",
};

const normalizeSkill = (skill: string): ScoutingActionSkill =>
  (skill in DEFAULT_OPTIONS ? skill : "receive") as ScoutingActionSkill;

export const getScoutingQualityOptionsForSkill = (skill: string): ScoutingQualityOption[] =>
  DEFAULT_OPTIONS[normalizeSkill(skill)];

export const getDefaultQualityOptionForSkill = (skill: string): ScoutingQualityOption =>
  getScoutingQualityOptionsForSkill(skill)[0];

export const resolveScoutingQualityOption = (
  skill: string,
  optionId: string
): ScoutingQualityOption => {
  const options = getScoutingQualityOptionsForSkill(skill);
  return options.find((item) => item.id === optionId) ?? options[0];
};

export const formatScoutingSkillLabel = (skill: string): string =>
  SKILL_LABELS[normalizeSkill(skill)];

export const formatScoutingActionTypeLabel = (skill: string, actionType?: string): string => {
  if (!actionType) return "Sem recorte";
  const option = getScoutingQualityOptionsForSkill(skill).find((item) => item.actionType === actionType);
  return option?.label ?? actionType;
};
