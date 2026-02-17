import type { AthletePosition, VolleyballSkill } from "../models";

type PositionWeights = Record<VolleyballSkill, number>;

const DEFAULT_WEIGHTS: PositionWeights = {
  passe: 1,
  levantamento: 1,
  ataque: 1,
  bloqueio: 1,
  defesa: 1,
  saque: 1,
  transicao: 1,
};

const POSITION_WEIGHTS: Record<AthletePosition, PositionWeights> = {
  indefinido: DEFAULT_WEIGHTS,
  levantador: {
    passe: 1.1,
    levantamento: 1.8,
    ataque: 0.7,
    bloqueio: 0.8,
    defesa: 1,
    saque: 1,
    transicao: 1.2,
  },
  oposto: {
    passe: 0.7,
    levantamento: 0.6,
    ataque: 1.8,
    bloqueio: 1.2,
    defesa: 0.9,
    saque: 1.1,
    transicao: 1,
  },
  ponteiro: {
    passe: 1.3,
    levantamento: 0.7,
    ataque: 1.5,
    bloqueio: 1,
    defesa: 1.1,
    saque: 1.1,
    transicao: 1.2,
  },
  central: {
    passe: 0.6,
    levantamento: 0.6,
    ataque: 1.3,
    bloqueio: 1.8,
    defesa: 0.8,
    saque: 0.9,
    transicao: 1,
  },
  libero: {
    passe: 1.8,
    levantamento: 0.8,
    ataque: 0.3,
    bloqueio: 0.2,
    defesa: 1.7,
    saque: 0.7,
    transicao: 1.2,
  },
};

export const getPositionWeights = (position: AthletePosition): PositionWeights => {
  return POSITION_WEIGHTS[position] ?? DEFAULT_WEIGHTS;
};
