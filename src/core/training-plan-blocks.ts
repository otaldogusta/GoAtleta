import type { TrainingPlan, TrainingPlanActivity, TrainingPlanSessionBlock } from "./models";

export type TrainingPlanBlockKey = "warmup" | "main" | "cooldown";

export type ResolvedTrainingPlanBlock = {
  key: TrainingPlanBlockKey;
  summary: string;
  activities: TrainingPlanActivity[];
  source: "pedagogy" | "legacy";
};

const legacyActivities = (
  plan: TrainingPlan,
  key: TrainingPlanBlockKey
): TrainingPlanActivity[] => {
  const names =
    key === "warmup" ? plan.warmup : key === "main" ? plan.main : plan.cooldown;
  return (names ?? [])
    .map((name) => String(name ?? "").trim())
    .filter(Boolean)
    .map((name) => ({ name, description: "" }));
};

const pedagogyBlock = (
  plan: TrainingPlan,
  key: TrainingPlanBlockKey
): TrainingPlanSessionBlock | undefined => {
  if (key === "warmup") return plan.pedagogy?.blocks?.warmup;
  if (key === "main") return plan.pedagogy?.blocks?.main;
  return plan.pedagogy?.blocks?.cooldown;
};

export const resolveTrainingPlanBlock = (
  plan: TrainingPlan | null | undefined,
  key: TrainingPlanBlockKey
): ResolvedTrainingPlanBlock => {
  const empty: ResolvedTrainingPlanBlock = {
    key,
    summary: "",
    activities: [],
    source: "legacy",
  };
  if (!plan) return empty;

  const richBlock = pedagogyBlock(plan, key);
  const richActivities = (richBlock?.activities ?? []).filter((activity) =>
    String(activity.name ?? "").trim()
  );

  if (richActivities.length) {
    return {
      key,
      summary: String(richBlock?.summary ?? "").trim(),
      activities: richActivities,
      source: "pedagogy",
    };
  }

  return {
    key,
    summary: "",
    activities: legacyActivities(plan, key),
    source: "legacy",
  };
};

export const resolveTrainingPlanBlocks = (
  plan: TrainingPlan | null | undefined
): Record<TrainingPlanBlockKey, ResolvedTrainingPlanBlock> => ({
  warmup: resolveTrainingPlanBlock(plan, "warmup"),
  main: resolveTrainingPlanBlock(plan, "main"),
  cooldown: resolveTrainingPlanBlock(plan, "cooldown"),
});

export const getResolvedTrainingPlanActivityNames = (
  plan: TrainingPlan | null | undefined,
  key: TrainingPlanBlockKey
) => resolveTrainingPlanBlock(plan, key).activities.map((activity) => activity.name);

