import { bootstrapDevExerciseMedia } from "./bootstrap-dev-exercise-media";
import { bootstrapExerciseMediaStore } from "./bootstrap-exercise-media-store";

type BootstrapExerciseMediaRuntimeOptions = {
  isDev?: boolean;
};

export function bootstrapExerciseMediaRuntime(
  options: BootstrapExerciseMediaRuntimeOptions = {}
): Promise<void> {
  const isDev = options.isDev ?? __DEV__;

  return bootstrapExerciseMediaStore()
    .catch(() => "memory" as const)
    .then(() => {
      if (isDev !== true) {
        return;
      }

      try {
        bootstrapDevExerciseMedia({ enabled: true });
      } catch {
        // Non-blocking: dev assets must never break app startup.
      }
    });
}
