import { isSupabaseExerciseMediaStoreActive } from "./bootstrap-exercise-media-store";
import { registerDevExerciseMediaAssets } from "./dev-exercise-media-assets";

type BootstrapOptions = {
  enabled?: boolean;
};

export function bootstrapDevExerciseMedia(
  options: BootstrapOptions = {}
): void {
  if (options.enabled !== true) {
    return;
  }

  if (isSupabaseExerciseMediaStoreActive()) {
    return;
  }

  registerDevExerciseMediaAssets();
}
