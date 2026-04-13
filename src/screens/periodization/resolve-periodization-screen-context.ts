import type {
    ClassCompetitiveProfile,
    ClassPlan,
    PeriodizationContext,
} from "../../core/models";
import type { PeriodizationModel } from "../../core/periodization-basics";
import { buildPeriodizationContext } from "../../core/periodization-context";
import { getPhysicalFocus } from "../../core/periodization-generator";
import type { WeekPlan } from "./CyclePlanTable";

type ResolvePeriodizationScreenContextParams = {
  activeCycleStartDate: string;
  visibleClassPlans: ClassPlan[];
  weekPlans: WeekPlan[];
  competitiveProfile: ClassCompetitiveProfile | null;
  periodizationModel: PeriodizationModel;
  ageBand: "06-08" | "09-11" | "12-14";
  selectedClassGoal?: string | null;
  normalizeText: (value: string) => string;
  parsePseTarget: (value: string | undefined) => number;
};

type ResolvePeriodizationScreenContextResult = {
  currentWeek: number;
  currentClassPlanForContext: ClassPlan | null;
  currentWeekPlanForContext: WeekPlan | null;
  periodizationContext: PeriodizationContext;
};

const parseIsoDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const resolvePeriodizationScreenContext = (
  params: ResolvePeriodizationScreenContextParams
): ResolvePeriodizationScreenContextResult => {
  const start =
    parseIsoDate(params.activeCycleStartDate ?? "") ??
    parseIsoDate(params.visibleClassPlans[0]?.startDate ?? "");

  const currentWeek = !start || !params.weekPlans.length
    ? 1
    : Math.max(
        1,
        Math.min(
          Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1,
          params.weekPlans.length
        )
      );

  const currentClassPlanForContext =
    params.visibleClassPlans.find((plan) => plan.weekNumber === currentWeek) ??
    params.visibleClassPlans[0] ??
    null;

  const currentWeekPlanForContext =
    params.weekPlans.find((week) => week.week === currentWeek) ??
    params.weekPlans[0] ??
    null;

  const periodizationContext = buildPeriodizationContext({
    objective: params.normalizeText(
      currentWeekPlanForContext?.title ||
        currentClassPlanForContext?.theme ||
        params.competitiveProfile?.targetCompetition ||
        params.selectedClassGoal ||
        "Desenvolvimento da turma"
    ),
    focus: params.normalizeText(
      currentWeekPlanForContext?.focus ||
        currentClassPlanForContext?.technicalFocus ||
        getPhysicalFocus(params.ageBand) ||
        "Fundamentos"
    ),
    classPlan: currentClassPlanForContext,
    constraints: [
      ...((currentWeekPlanForContext?.notes ?? []).filter(Boolean)),
      ...(currentClassPlanForContext?.constraints
        ? [currentClassPlanForContext.constraints]
        : []),
    ],
    pedagogicalIntent: params.normalizeText(
      params.periodizationModel === "competitivo"
        ? "Equilibrar exigência competitiva com controle de carga"
        : params.periodizationModel === "formacao"
          ? "Organizar progressão pedagógica da turma"
          : "Conectar aprendizagem e exigência competitiva"
    ),
    load: currentWeekPlanForContext
      ? {
          intendedRPE: params.parsePseTarget(currentWeekPlanForContext.PSETarget),
          volume:
            currentWeekPlanForContext.volume === "médio"
              ? "moderado"
              : currentWeekPlanForContext.volume,
        }
      : null,
    planningMode: params.competitiveProfile?.planningMode ?? null,
    competitivePhase: params.competitiveProfile?.currentPhase ?? null,
  });

  return {
    currentWeek,
    currentClassPlanForContext,
    currentWeekPlanForContext,
    periodizationContext,
  };
};
