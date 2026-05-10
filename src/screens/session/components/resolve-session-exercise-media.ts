import { resolveExerciseMedia } from "../../../exercise-media/resolve-exercise-media";
import type {
  ExerciseMediaResolutionResult,
} from "../../../exercise-media/exercise-media.types";
import type {
  ResistanceExerciseCategory,
  ResistanceSportContext,
  ResistanceTrainingContext,
} from "../../../core/models";

const SPORTS_FROM_CONTEXT: Partial<
  Record<ResistanceTrainingContext, ResistanceSportContext>
> = {
  volleyball: "volleyball",
  soccer: "soccer",
  running: "running",
  basketball: "basketball",
};

const buildTags = (params: {
  category?: ResistanceExerciseCategory;
  transferTarget?: string;
}): string[] => {
  const tags = new Set<string>();

  if (params.category) {
    tags.add(params.category);
  }

  const transferTarget = String(params.transferTarget ?? "").trim();
  if (transferTarget) {
    tags.add(transferTarget);
  }

  return [...tags];
};

export function resolveSessionExerciseMedia(params: {
  exerciseName: string;
  category?: ResistanceExerciseCategory;
  transferTarget?: string;
  trainingContext?: ResistanceTrainingContext;
  sportContext?: ResistanceSportContext;
}): ExerciseMediaResolutionResult {
  const sport =
    params.sportContext ??
    (params.trainingContext ? SPORTS_FROM_CONTEXT[params.trainingContext] : undefined);

  return resolveExerciseMedia({
    exerciseName: params.exerciseName,
    modality: "treino_resistido",
    sport,
    preferredKind: "video",
    tags: buildTags({
      category: params.category,
      transferTarget: params.transferTarget,
    }),
  });
}
