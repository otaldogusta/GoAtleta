import { normalizeAgeBand, parseAgeBandRange } from "../age-band";
import { buildNextClassSuggestion } from "../intelligence/suggestion-engine";
import {
  buildPlanDiff,
  buildPlanReviewSummary,
  createDraftWeeklyPlanGraph,
  toClassPlansFromPlanningGraph,
  type Objective,
  type Phase,
} from "../plan-engine";
import type {
  ClassGroup,
  SessionLog,
  WeeklyAutopilotKnowledgeContext,
  WeeklyAutopilotProposal,
} from "../models";

const normalizeText = (value: string | null | undefined) => String(value ?? "").trim();

const resolveWeeklyAutopilotPlanObjective = (
  classGroup: ClassGroup,
  knowledgeDomain: WeeklyAutopilotKnowledgeContext["domain"],
  suggestionSummary: string
): Objective => {
  const goal = normalizeText(classGroup.goal).toLowerCase();
  const summary = normalizeText(suggestionSummary).toLowerCase();

  if (goal.includes("recuper") || summary.includes("recuper")) return "recovery";
  if (knowledgeDomain === "performance" || goal.includes("performance") || classGroup.level >= 3) {
    return "performance";
  }
  if (goal.includes("jogo") || goal.includes("transicao") || summary.includes("jogo")) {
    return "game_transfer";
  }
  if (goal.includes("forca") || goal.includes("potenc") || goal.includes("carga")) {
    return "load_progression";
  }
  if (goal.includes("consist") || goal.includes("tecn") || goal.includes("fundament")) {
    return "technical_consistency";
  }
  return "motor_learning";
};

const resolveWeeklyAutopilotPlanPhase = (
  objective: Objective,
  knowledgeDomain: WeeklyAutopilotKnowledgeContext["domain"],
  classGroup: ClassGroup
): Phase => {
  if (objective === "recovery") return "recovery";
  if (objective === "performance") return knowledgeDomain === "performance" ? "intensification" : "development";
  if (objective === "load_progression") return classGroup.level >= 3 ? "intensification" : "development";
  if (objective === "game_transfer") return "development";
  if (objective === "technical_consistency") return classGroup.level <= 1 ? "base" : "development";
  return "base";
};

export const resolveWeeklyAutopilotKnowledgeDomain = (classGroup: ClassGroup) => {
  const range = parseAgeBandRange(normalizeAgeBand(classGroup.ageBand));
  if (range && range.end <= 17) return "youth_training";

  const goal = normalizeText(classGroup.goal).toLowerCase();
  const mvLevel = normalizeText(classGroup.mvLevel).toLowerCase();
  if (goal.includes("performance") || mvLevel.includes("performance") || classGroup.level >= 3) {
    return "performance";
  }

  if (goal.includes("fitness") || classGroup.equipment === "funcional") {
    return "general_fitness";
  }

  return "general";
};

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
  knowledgeContext?: WeeklyAutopilotKnowledgeContext | null;
}): WeeklyAutopilotProposal => {
  const suggestion = buildNextClassSuggestion({
    className: input.classGroup.name,
    logs: input.logs,
  });

  const nowIso = new Date().toISOString();
  const knowledgeContext = input.knowledgeContext ?? null;
  const knowledgeDomain = knowledgeContext?.domain ?? resolveWeeklyAutopilotKnowledgeDomain(input.classGroup);
  const knowledgeBaseVersionLabel = knowledgeContext?.versionLabel ?? "";
  const knowledgeLead = knowledgeBaseVersionLabel
    ? `Base cientifica ${knowledgeBaseVersionLabel} (${knowledgeDomain}).`
    : "Base cientifica nao configurada.";
  const knowledgeHighlights = (knowledgeContext?.ruleHighlights ?? []).slice(0, 3);
  const knowledgeReferences = (knowledgeContext?.references ?? []).slice(0, 3);
  const objective = resolveWeeklyAutopilotPlanObjective(
    input.classGroup,
    knowledgeDomain,
    suggestion.coachSummary
  );
  const phase = resolveWeeklyAutopilotPlanPhase(objective, knowledgeDomain, input.classGroup);
  const draftPlan = createDraftWeeklyPlanGraph({
    classId: input.classGroup.id,
    organizationId: input.organizationId,
    knowledgeSnapshot: knowledgeContext,
    objective,
    phase,
    technicalFocus: knowledgeHighlights.length ? [knowledgeHighlights[0]] : undefined,
    physicalFocus: knowledgeHighlights.length > 1 ? [knowledgeHighlights[1]] : undefined,
    summary: suggestion.coachSummary,
    source: "AUTO",
  });
  const review = knowledgeContext ? buildPlanReviewSummary(draftPlan, knowledgeContext) : null;
  const baselinePlan = createDraftWeeklyPlanGraph({
    classId: input.classGroup.id,
    organizationId: input.organizationId,
    knowledgeSnapshot: null,
    objective,
    phase,
    technicalFocus: knowledgeHighlights.length ? [knowledgeHighlights[0]] : undefined,
    physicalFocus: knowledgeHighlights.length > 1 ? [knowledgeHighlights[1]] : undefined,
    summary: suggestion.coachSummary,
    source: "AUTO",
  });
  const reviewDiffs =
    knowledgeContext && draftPlan.weeks[0] && baselinePlan.weeks[0]
      ? [buildPlanDiff(baselinePlan.weeks[0], draftPlan.weeks[0])]
      : [];
  const planReview = review
    ? {
        ok: review.ok,
        versionLabel: review.versionLabel,
        domain: review.domain,
        diffs: reviewDiffs,
        issues: review.issues.map((issue) => ({
          weekStart: issue.weekStart,
          code: issue.code,
          message: issue.message,
          severity: issue.severity,
          reference: issue.reference ?? null,
          ruleId: issue.ruleId ?? null,
          ruleType: issue.ruleType ?? null,
          priority: issue.priority ?? null,
          autoCorrected: Boolean(issue.autoCorrected),
        })),
        warnings: review.issues
          .filter((issue) => issue.severity !== "info")
          .map((issue) => issue.message),
        citations: [...new Set(review.issues.map((issue) => issue.reference).filter(Boolean) as string[])],
      }
    : null;
  const actions = [...suggestion.actions];
  if (knowledgeHighlights.length > 0) {
    actions.unshift(`Diretriz da base: ${knowledgeHighlights[0]}`);
  }
  if (review) {
    const reviewActions = review.issues.slice(0, 3).map((issue) => {
      const reference = issue.reference ? ` (${issue.reference})` : "";
      return `Revisao do motor: ${issue.message}${reference}`;
    });
    if (review.ok) {
      actions.push("Revisao do motor: sem alertas na base cientifica ativa.");
    } else {
      actions.push(...reviewActions);
    }
  }

  return {
    id: `auto_${input.classGroup.id}_${Date.now()}`,
    organizationId: input.organizationId,
    classId: input.classGroup.id,
    weekStart: toWeekStartIso(),
    summary: [
      knowledgeLead,
      suggestion.coachSummary,
      review
        ? review.ok
          ? "Revisao do motor semanal sem alertas."
          : `Revisao do motor semanal identificou ${review.issues.length} alerta(s).`
        : "Revisao do motor aguardando base cientifica ativa.",
      `Acoes-chave para a semana: ${suggestion.actions[0] ?? "definir foco tecnico principal."}`,
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
    actions,
    proposedPlanIds: toClassPlansFromPlanningGraph(draftPlan).map((plan) => plan.id),
    status: "proposed",
    createdBy: input.createdBy,
    knowledgeBaseVersionId: knowledgeContext?.versionId ?? null,
    knowledgeBaseVersionLabel,
    knowledgeDomain,
    knowledgeReferences,
    knowledgeRuleHighlights: knowledgeHighlights,
    planReview,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
};
