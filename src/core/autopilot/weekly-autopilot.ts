import { buildNextClassSuggestion } from "../intelligence/suggestion-engine";
import type { ClassGroup, SessionLog, WeeklyAutopilotProposal } from "../models";

const toWeekStartIso = (baseDate = new Date()) => {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const buildWeeklyAutopilotProposal = (input: {
  classGroup: ClassGroup;
  logs: SessionLog[];
  organizationId: string;
  createdBy: string;
}): WeeklyAutopilotProposal => {
  const suggestion = buildNextClassSuggestion({
    className: input.classGroup.name,
    logs: input.logs,
  });

  const nowIso = new Date().toISOString();
  return {
    id: `auto_${input.classGroup.id}_${Date.now()}`,
    organizationId: input.organizationId,
    classId: input.classGroup.id,
    weekStart: toWeekStartIso(),
    summary: `${suggestion.coachSummary} Ações-chave para a semana: ${suggestion.actions[0] ?? "definir foco técnico principal."}`,
    actions: suggestion.actions,
    proposedPlanIds: [],
    status: "proposed",
    createdBy: input.createdBy,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
};
