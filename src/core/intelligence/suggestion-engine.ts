import type { SessionLog } from "../models";
import { trackClassEvolution } from "./evolution-tracker";

export type NextClassSuggestion = {
  headline: string;
  radarScore: number;
  trendLabel: "subindo" | "estavel" | "queda";
  coachSummary: string;
  actions: string[];
  alerts: string[];
  nextTrainingPrompt: string;
  requiresHumanApproval: true;
};

const pct = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

export const buildNextClassSuggestion = (input: {
  className: string;
  logs: SessionLog[];
}): NextClassSuggestion => {
  const { className, logs } = input;
  const evolution = trackClassEvolution(logs);

  const trendLabel =
    evolution.trend === "up" ? "subindo" : evolution.trend === "down" ? "queda" : "estavel";

  const skills = evolution.prioritySkills.join(" + ");
  const actions = [
    `Abrir com bloco preventivo curto e ativação técnica com foco em ${skills}.`,
    `Definir 2 critérios observáveis: consistência técnica (${pct(evolution.recent.techniqueScore)}) e presença ativa no exercício.`,
    "Fechar com jogo reduzido condicionado para transferir o fundamento ao contexto real.",
  ];

  const coachSummary =
    logs.length === 0
      ? "Sem dados recentes para leitura de tendência."
      : `Radar da turma em ${pct(evolution.recent.overallScore)} com tendência ${trendLabel}.`;

  const nextTrainingPrompt = [
    `Monte o próximo treino da turma ${className} com foco principal em ${skills}.`,
    "Estruture em aquecimento preventivo, bloco técnico com critérios mensuráveis e jogo condicionado final.",
    "Considere ajuste de carga para manter PSE alvo próximo de 6 e preservar qualidade de execução.",
  ].join(" ");

  return {
    headline: `Sugestão para próxima aula - ${className}`,
    radarScore: evolution.recent.overallScore,
    trendLabel,
    coachSummary,
    actions,
    alerts: evolution.recent.alerts,
    nextTrainingPrompt,
    requiresHumanApproval: true,
  };
};
