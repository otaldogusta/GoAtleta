import { evaluateSessionSkillSnapshot } from "../intelligence/skill-evaluator";
import type { EvolutionSimulationResult, SessionLog } from "../models";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const simulateClassEvolution = (input: {
  classId: string;
  logs: SessionLog[];
  horizonWeeks: number;
  interventionIntensity: "conservative" | "balanced" | "aggressive";
}): EvolutionSimulationResult => {
  const baseline = evaluateSessionSkillSnapshot(input.logs).overallScore;
  const horizon = Math.max(2, Math.min(12, Math.floor(input.horizonWeeks || 6)));
  const gainPerWeek =
    input.interventionIntensity === "aggressive"
      ? 0.03
      : input.interventionIntensity === "balanced"
        ? 0.02
        : 0.012;

  const points = Array.from({ length: horizon }).map((_, index) => {
    const week = index + 1;
    const fatiguePenalty = week % 4 === 0 ? 0.006 : 0;
    const projectedScore = clamp01(baseline + gainPerWeek * week - fatiguePenalty);
    const confidence = clamp01(0.84 - week * 0.045);
    return {
      week,
      projectedScore,
      confidence,
      focus:
        week <= 2
          ? "consolidação técnica"
          : week <= 4
            ? "transferência para jogo condicionado"
            : "estabilização sob pressão",
    };
  });

  return {
    classId: input.classId,
    baselineScore: baseline,
    horizonWeeks: horizon,
    assumptions: [
      "Projeção determinística baseada no histórico recente de sessões.",
      "Aderência semanal da turma mantida sem interrupções críticas.",
      "Aprovação humana obrigatória antes de aplicar qualquer ajuste real.",
    ],
    points,
    requiresHumanApproval: true,
  };
};
