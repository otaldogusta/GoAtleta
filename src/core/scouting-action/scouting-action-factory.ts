import type {
  CreateScoutingActionInput,
  ScoutingAction,
  ScoutingActionQuality,
  ScoutingActionScore,
  ScoutingActionSkill,
} from "./types";

const buildId = () => `scouting_action_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const cleanOptional = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : undefined;
};

const SKILL_ALIASES: Record<string, ScoutingActionSkill> = {
  serve: "serve",
  saque: "serve",
  receive: "receive",
  recepcao: "receive",
  recepção: "receive",
  passe: "receive",
  set: "set",
  toque: "set",
  levantamento: "set",
  attack: "attack",
  ataque: "attack",
  block: "block",
  bloqueio: "block",
  defense: "defense",
  defesa: "defense",
  coverage: "coverage",
  cobertura: "coverage",
  transition: "transition",
  transicao: "transition",
  transição: "transition",
  communication: "communication",
  comunicacao: "communication",
  comunicação: "communication",
};

const QUALITY_ALIASES: Record<string, ScoutingActionQuality> = {
  error: "error",
  erro: "error",
  low: "low",
  baixo: "low",
  c: "low",
  medium: "medium",
  medio: "medium",
  médio: "medium",
  b: "medium",
  high: "high",
  alto: "high",
  difficult: "high",
  dificil: "high",
  difícil: "high",
  a: "excellent",
  excellent: "excellent",
  excelente: "excellent",
  ace: "excellent",
};

export const normalizeScoutingSkill = (value: string): ScoutingActionSkill => {
  const key = value.trim().toLowerCase();
  return SKILL_ALIASES[key] ?? "communication";
};

export const normalizeScoutingQuality = (value: string): ScoutingActionQuality => {
  const key = value.trim().toLowerCase();
  return QUALITY_ALIASES[key] ?? "medium";
};

export const deriveActionScore = (
  qualityOrLabel: string,
  skill?: ScoutingActionSkill
): ScoutingActionScore => {
  const normalized = normalizeScoutingQuality(qualityOrLabel);
  if (skill === "receive") {
    const key = qualityOrLabel.trim().toLowerCase();
    if (key === "a") return 3;
    if (key === "b") return 2;
    if (key === "c") return 1;
  }
  if (skill === "serve") {
    const key = qualityOrLabel.trim().toLowerCase();
    if (key === "in_play" || key === "em_jogo") return 1;
    if (key === "difficult" || key === "difícil" || key === "dificil") return 2;
    if (key === "ace") return 3;
  }
  if (normalized === "error") return 0;
  if (normalized === "low") return 1;
  if (normalized === "medium") return 2;
  return 3;
};

export const createScoutingAction = (input: CreateScoutingActionInput): ScoutingAction => {
  const skill = normalizeScoutingSkill(input.skill);
  const quality = normalizeScoutingQuality(input.quality);
  const score = input.score ?? deriveActionScore(input.quality, skill);
  return {
    id: buildId(),
    scoutingSessionId: input.scoutingSessionId,
    classId: input.classId,
    athleteId: cleanOptional(input.athleteId),
    athleteName: cleanOptional(input.athleteName),
    skill,
    actionType: input.actionType.trim() || skill,
    quality,
    score,
    label: cleanOptional(input.label),
    gamePhase: input.gamePhase,
    pressureLevel: input.pressureLevel,
    rotation: cleanOptional(input.rotation),
    zone: cleanOptional(input.zone),
    videoTimestampSec:
      typeof input.videoTimestampSec === "number" && Number.isFinite(input.videoTimestampSec)
        ? input.videoTimestampSec
        : undefined,
    notes: cleanOptional(input.notes),
    source: input.source ?? "coach",
    createdAt: new Date().toISOString(),
  };
};
