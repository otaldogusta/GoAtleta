import { useMemo } from "react";
import type { CopilotAction } from "../../../copilot/CopilotProvider";
import type { PeriodizationModel, SportProfile } from "../../../core/periodization-basics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PeriodizationCopilotSnapshot = {
  classLabel: string;
  model: PeriodizationModel;
  sport: SportProfile;
  sportLabel: string;
  durationMinutes: number;
  periodSummary: string;
  dominantSummary: string;
  weeks: number;
  currentWeek: number;
  nextWeekLabel: string;
  nextDemand: string;
  nextPse: string;
  nextPlannedLoad: string;
  nextLoad: string;
};

export type UsePeriodizationCopilotActionsParams = {
  periodizationCopilotSnapshot: PeriodizationCopilotSnapshot;
  weekPlansLength: number;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePeriodizationCopilotActions(
  params: UsePeriodizationCopilotActionsParams
): CopilotAction[] {
  const { periodizationCopilotSnapshot, weekPlansLength } = params;

  return useMemo(
    () => [
      {
        id: "periodization_review_modern_model",
        title: "Revisar ciclo atual",
        description: "Analisa a coerência do macrociclo e dos blocos dominantes.",
        requires: () => (weekPlansLength ? null : "Gere o ciclo para habilitar esta análise."),
        run: () => {
          const highlights = [
            `Turma: ${periodizationCopilotSnapshot.classLabel}`,
            `Esporte: ${periodizationCopilotSnapshot.sportLabel}`,
            `Ciclo: ${periodizationCopilotSnapshot.weeks} semanas (semana atual ${periodizationCopilotSnapshot.currentWeek})`,
            `Períodos: ${periodizationCopilotSnapshot.periodSummary}`,
            `Blocos dominantes: ${periodizationCopilotSnapshot.dominantSummary}`,
          ];
          const suggestions = [
            "Mantenha transição progressiva de demanda entre blocos para evitar salto brusco.",
            "No competitivo, prefira redução de volume na semana-alvo com intensidade técnica alta.",
            "Valide semanalmente o desvio entre demanda planejada e PSE real para ajustar o bloco seguinte.",
          ];
          return `${highlights.join("\n")}\n\nAjustes recomendados:\n1. ${suggestions[0]}\n2. ${suggestions[1]}\n3. ${suggestions[2]}`;
        },
      },
      {
        id: "periodization_next_week_adjust",
        title: "Ajustar próxima semana",
        description: "Propõe ajustes de carga e PSE da próxima semana.",
        requires: () => (weekPlansLength ? null : "Gere o ciclo para habilitar esta análise."),
        run: () => {
          const demandValue = Number.parseInt(periodizationCopilotSnapshot.nextDemand, 10);
          const targetLoad = demandValue >= 9 ? "Média" : periodizationCopilotSnapshot.nextLoad;
          const targetDemand = demandValue >= 9 ? "8/10" : periodizationCopilotSnapshot.nextDemand;
          const targetPse = demandValue >= 9 ? "5-6" : periodizationCopilotSnapshot.nextPse;
          const focus = targetLoad === "Alta" ? "potência específica com controle de volume" : "qualidade técnica e consistência tática";

          return [
            `Referência: ${periodizationCopilotSnapshot.nextWeekLabel} (${periodizationCopilotSnapshot.classLabel})`,
            `Esporte base da turma: ${periodizationCopilotSnapshot.sportLabel}`,
            `Planejado atual: carga ${periodizationCopilotSnapshot.nextLoad}, demanda ${periodizationCopilotSnapshot.nextDemand}, PSE ${periodizationCopilotSnapshot.nextPse}`,
            `Ajuste sugerido: carga ${targetLoad}, demanda ${targetDemand}, PSE ${targetPse}`,
            `Foco da semana: ${focus}.`,
          ].join("\n");
        },
      },
      {
        id: "periodization_plan_vs_real",
        title: "Planejado vs real",
        description: "Gera roteiro para comparar demanda planejada com PSE real coletado.",
        requires: () => (weekPlansLength ? null : "Gere o ciclo para habilitar esta análise."),
        run: () => {
          return [
            `Checklist Planejado vs Real (${periodizationCopilotSnapshot.classLabel})`,
            `Esporte: ${periodizationCopilotSnapshot.sportLabel}`,
            "1. Registrar demanda planejada da semana (ex.: 7/10).",
            "2. Coletar PSE médio real da turma ao fim das sessões.",
            "3. Calcular desvio: real - planejado.",
            "4. Decisão: |desvio| <= 1 mantém bloco; desvio > 1 reduz próxima carga; desvio < -1 pode progredir.",
            "5. Documentar ajuste aplicado no próximo microciclo.",
          ].join("\n");
        },
      },
    ],
    [periodizationCopilotSnapshot, weekPlansLength]
  );
}
