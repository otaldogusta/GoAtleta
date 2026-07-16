import type { TrainingPlanBlockKey } from "../../../core/training-plan-blocks";
import type { GoAtletaIconName } from "../../../ui/icon-registry";

export const CLASS_PLAN_BLOCK_PRESENTATION: Record<
  TrainingPlanBlockKey,
  { label: string; icon: GoAtletaIconName }
> = {
  warmup: { label: "Aquecimento", icon: "warmup" },
  main: { label: "Parte principal", icon: "mainActivity" },
  cooldown: { label: "Volta à calma", icon: "cooldown" },
};

export const CLASS_PLAN_BLOCK_KEYS: TrainingPlanBlockKey[] = ["warmup", "main", "cooldown"];

export const CLASS_PLAN_ACTIVITY_PREVIEW_LIMIT = 2;

export function summarizeClassPlanActivities<T>(activities: readonly T[]) {
  return {
    visibleActivities: activities.slice(0, CLASS_PLAN_ACTIVITY_PREVIEW_LIMIT),
    remainingCount: Math.max(activities.length - CLASS_PLAN_ACTIVITY_PREVIEW_LIMIT, 0),
  };
}
