import type { AthletePosition, VolleyballSkill } from "../models";
import { getPositionWeights } from "./position-weights";

export type SkillScoreMap = Partial<Record<VolleyballSkill, number>>;

export const POSITION_PRIORITY: Record<AthletePosition, VolleyballSkill[]> = {
  indefinido: ["passe", "levantamento", "saque", "defesa", "ataque", "bloqueio", "transicao"],
  levantador: ["levantamento", "passe", "transicao", "defesa", "saque", "bloqueio", "ataque"],
  oposto: ["ataque", "bloqueio", "saque", "transicao", "defesa", "passe", "levantamento"],
  ponteiro: ["passe", "ataque", "saque", "defesa", "transicao", "bloqueio", "levantamento"],
  central: ["bloqueio", "ataque", "transicao", "saque", "defesa", "passe", "levantamento"],
  libero: ["passe", "defesa", "transicao", "levantamento", "saque", "ataque", "bloqueio"],
};

export const computePositionWeightedScore = (
  position: AthletePosition,
  scores: SkillScoreMap
): number => {
  const weights = getPositionWeights(position);
  let weighted = 0;
  let totalWeight = 0;

  (Object.keys(weights) as VolleyballSkill[]).forEach((skill) => {
    const raw = Number(scores[skill] ?? 0);
    const weight = weights[skill];
    if (!Number.isFinite(raw) || raw < 0) return;
    weighted += raw * weight;
    totalWeight += weight;
  });

  if (totalWeight <= 0) return 0;
  return Number((weighted / totalWeight).toFixed(2));
};
