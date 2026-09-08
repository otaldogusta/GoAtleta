import type { TrainingPlan } from "../../../core/models";
import type { CopilotContextData } from "../../../copilot/types";

export function buildPlanningCopilotContext(plan: TrainingPlan | null, className?: string, date?: string): CopilotContextData {
  return {
    screen: "planning",
    title: "Planejamento",
    operationalFacts: [
      { key: "planning_state", label: "Plano aberto", value: plan?.title || "Nenhum plano selecionado" },
      ...(plan ? [
        { key: "planning_class", label: "Turma do plano", value: className || "Sem turma vinculada" },
        { key: "planning_date", label: "Data planejada", value: date || plan.applyDate || "Não definida" },
        ...(["warmup", "main", "cooldown"] as const).map((block, index) => ({
          key: `planning_${block}`, label: ["Aquecimento", "Parte principal", "Volta à calma"][index],
          value: plan[`${block}Time`] || "Duração não definida", details: plan[block].slice(0, 12),
        })),
      ] : []),
    ],
  };
}
