import type { TrainingPlanActivity } from "./models";

const normalizeActivityName = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const getTrainingPlanActivityNameDedupeKey = (
  activity: Pick<TrainingPlanActivity, "name">
) => `name:${normalizeActivityName(activity.name)}`;

export const getTrainingPlanActivitySourceLabel = (
  activity: Pick<TrainingPlanActivity, "catalog"> | null | undefined
) => {
  if (activity?.catalog?.source === "goAtletaCatalog") return "Catálogo GoAtleta";
  return null;
};

export const getTrainingPlanActivityDedupeKey = (
  activity: Pick<TrainingPlanActivity, "catalog" | "name">
) => {
  if (activity.catalog?.source === "goAtletaCatalog" && activity.catalog.variantId) {
    return `catalog:${activity.catalog.variantId}`;
  }
  return getTrainingPlanActivityNameDedupeKey(activity);
};

export const hasMatchingTrainingPlanActivity = (
  activities: TrainingPlanActivity[],
  candidate: TrainingPlanActivity
) => {
  const candidateKeys = new Set([
    getTrainingPlanActivityDedupeKey(candidate),
    getTrainingPlanActivityNameDedupeKey(candidate),
  ]);

  return activities.some((activity) =>
    [
      getTrainingPlanActivityDedupeKey(activity),
      getTrainingPlanActivityNameDedupeKey(activity),
    ].some((key) => candidateKeys.has(key))
  );
};
