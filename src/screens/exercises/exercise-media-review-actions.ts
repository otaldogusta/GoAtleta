import {
  approveExerciseMediaAsset,
  archiveExerciseMediaAsset,
} from "../../exercise-media/exercise-media-approval";

export function approveExerciseMediaReviewAsset(id: string) {
  return approveExerciseMediaAsset(id, { by: "local-dev" });
}

export function archiveExerciseMediaReviewAsset(id: string) {
  return archiveExerciseMediaAsset(id, { by: "local-dev" });
}
