import type {
  TrainingPlanGenerationMode,
  TrainingPlanPedagogy,
  TrainingPlanPlanningBasis,
} from "../../../core/models";
import type { AutoPlanForCycleDayResult } from "./build-auto-plan-for-cycle-day";

export const toGenerationMode = (
  planningBasis: TrainingPlanPlanningBasis
): TrainingPlanGenerationMode =>
  planningBasis === "cycle_based" ? "periodized" : "class_bootstrap";

export const buildPersistedGenerationExplanation = (
  explanation: AutoPlanForCycleDayResult["explanation"],
  planningBasis: TrainingPlanPlanningBasis
): NonNullable<TrainingPlanPedagogy["generationExplanation"]> => ({
  historyMode: explanation.historyMode,
  summary: explanation.summary,
  coachSummary: explanation.coachSummary,
  planningBasis,
  generationMode: toGenerationMode(planningBasis),
});
