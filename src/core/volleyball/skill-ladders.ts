import type { ProgressionDimension, VolleyballSkill } from "../models";

const LADDER_STEPS: Record<VolleyballSkill, string[]> = {
  passe: ["base", "plataforma-direcao", "alvo-dinamico", "leitura-oposicao"],
  levantamento: ["base", "tempo-bola", "variacao-zona", "decisao-jogo"],
  ataque: ["base", "entrada-controle", "alvo-intencional", "decisao-bloqueio"],
  bloqueio: ["base", "tempo-salto", "fechamento-linha", "leitura-levantador"],
  defesa: ["base", "base-defensiva", "ajuste-trajetoria", "cobertura-transicao"],
  saque: ["base", "consistencia-zona", "variacao-alvo", "risco-controlado"],
  transicao: ["base", "organizacao-pos-contato", "tempo-recomposicao", "continuidade-jogo"],
};

const dimensionStepDelta: Record<ProgressionDimension, number> = {
  consistencia: 0,
  precisao: 1,
  pressao_tempo: 1,
  oposicao: 2,
  tomada_decisao: 3,
  transferencia_jogo: 3,
};

export function resolveLadderTransition(
  skill: VolleyballSkill,
  dimension: ProgressionDimension
) {
  const steps = LADDER_STEPS[skill] ?? LADDER_STEPS.passe;
  const fromIndex = Math.max(0, Math.min(steps.length - 2, dimensionStepDelta[dimension] - 1));
  const toIndex = Math.max(fromIndex + 1, Math.min(steps.length - 1, fromIndex + 1));

  return {
    from: steps[fromIndex],
    to: steps[toIndex],
  };
}
