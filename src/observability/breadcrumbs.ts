import * as Sentry from "@sentry/react-native";
import type { CycleDayGenerationExplanation } from "../core/cycle-day-planning/format-generation-explanation";

export const logNavigation = (pathname: string) => {
  if (!pathname) return;
  Sentry.addBreadcrumb({
    category: "navigation",
    message: `Route: ${pathname}`,
    level: "info",
  });
};

export const logAction = (name: string, data: Record<string, unknown>) => {
  if (!name) return;
  Sentry.addBreadcrumb({
    category: "action",
    message: name,
    data,
    level: "info",
  });
};

export const logPlanGenerationDecision = (params: {
  classId: string;
  sessionDate: string;
  variationSeed?: number;
  explanation: CycleDayGenerationExplanation;
  planningBasis?: "cycle_based" | "class_based_bootstrap";
  generationMode?: "periodized" | "class_bootstrap";
  ageBand?: string;
  developmentStage?: string;
  warmupSummary?: string;
  warmupSource?: "engine" | "age_sanitizer";
  usedAgeSanitizer?: boolean;
  ageSanitizerReasons?: string[];
  pedagogyTone?: "ludico" | "guiado" | "desafio_progressivo" | "jogo_aplicado";
  pedagogyLanguageProfile?: "infantil" | "juvenil" | "tecnico";
  pedagogyFeedbackStyle?: "positivo_curto" | "pergunta_guiada" | "reflexao_rapida";
  pedagogyMainStyle?: string[];
  pedagogyCooldownStyle?: string[];
}) => {
  if (!params.explanation.summary) return;
  Sentry.addBreadcrumb({
    category: "session-generation",
    message: params.explanation.summary,
    data: {
      classId: params.classId,
      sessionDate: params.sessionDate,
      variationSeed: params.variationSeed ?? null,
      ...params.explanation.debug,
      historyMode: params.explanation.historyMode,
      planningBasis: params.planningBasis ?? null,
      generationMode: params.generationMode ?? null,
      ageBand: params.ageBand ?? null,
      developmentStage: params.developmentStage ?? null,
      warmupSummary: params.warmupSummary ?? null,
      warmupSource: params.warmupSource ?? null,
      usedAgeSanitizer: params.usedAgeSanitizer ?? false,
      ageSanitizerReasons: params.ageSanitizerReasons ?? [],
      pedagogyTone: params.pedagogyTone ?? null,
      pedagogyLanguageProfile: params.pedagogyLanguageProfile ?? null,
      pedagogyFeedbackStyle: params.pedagogyFeedbackStyle ?? null,
      pedagogyMainStyle: params.pedagogyMainStyle ?? [],
      pedagogyCooldownStyle: params.pedagogyCooldownStyle ?? [],
      coachSummary: params.explanation.coachSummary,
    },
    level: "info",
  });
};
