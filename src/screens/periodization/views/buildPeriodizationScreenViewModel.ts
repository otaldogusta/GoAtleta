import React from "react";

import type {
    ClassGroup,
    PeriodizationContext,
    WeeklyAutopilotKnowledgeContext,
    WeeklyAutopilotPlanReview,
} from "../../../core/models";
import { type ThemeColors } from "../../../ui/app-theme";
import { CycleTab } from "../CycleTab";
import { OverviewTab } from "../OverviewTab";
import { WeekTab } from "../WeekTab";

export type ContextCardProps = {
  selectedClass: ClassGroup | null;
  normalizeText: (value: string) => string;
  periodizationContext: PeriodizationContext;
  isLoadingPeriodizationKnowledge: boolean;
  periodizationKnowledgeSnapshot: WeeklyAutopilotKnowledgeContext | null;
  periodizationPlanReview: WeeklyAutopilotPlanReview | null;
  formatPeriodizationContextModel: (value: PeriodizationContext["model"]) => string;
  formatPeriodizationContextLoad: (context: PeriodizationContext) => string | null;
};

export type PeriodizationScreenViewModel = {
  activeTab: "geral" | "ciclo" | "semana";
  colors: ThemeColors;
  contextCardProps: ContextCardProps;
  overviewTabProps: React.ComponentProps<typeof OverviewTab>;
  cycleTabProps: React.ComponentProps<typeof CycleTab>;
  weekTabProps: React.ComponentProps<typeof WeekTab>;
};

type BuildInput = ContextCardProps & {
  activeTab: "geral" | "ciclo" | "semana";
  colors: ThemeColors;
  overviewTabProps: React.ComponentProps<typeof OverviewTab>;
  cycleTabProps: React.ComponentProps<typeof CycleTab>;
  weekTabProps: React.ComponentProps<typeof WeekTab>;
};

export function buildPeriodizationScreenViewModel(
  input: BuildInput
): PeriodizationScreenViewModel {
  return {
    activeTab: input.activeTab,
    colors: input.colors,
    contextCardProps: {
      selectedClass: input.selectedClass,
      normalizeText: input.normalizeText,
      periodizationContext: input.periodizationContext,
      isLoadingPeriodizationKnowledge: input.isLoadingPeriodizationKnowledge,
      periodizationKnowledgeSnapshot: input.periodizationKnowledgeSnapshot,
      periodizationPlanReview: input.periodizationPlanReview,
      formatPeriodizationContextModel: input.formatPeriodizationContextModel,
      formatPeriodizationContextLoad: input.formatPeriodizationContextLoad,
    },
    overviewTabProps: input.overviewTabProps,
    cycleTabProps: input.cycleTabProps,
    weekTabProps: input.weekTabProps,
  };
}
