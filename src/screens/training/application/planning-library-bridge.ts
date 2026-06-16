import type {
  Exercise,
  TrainingPlan,
  TrainingPlanActivity,
  TrainingPlanPedagogy,
  TrainingPlanSessionBlock,
} from "../../../core/models";
import {
  hasMatchingTrainingPlanActivity,
} from "../../../core/training-plan-activity-source";
import {
  resolveTrainingPlanBlock,
  type TrainingPlanBlockKey,
} from "../../../core/training-plan-blocks";
import { phaseLabels, skillLabels } from "../../library/activity-catalog-labels";
import type { ActivityCatalogListItem } from "../../library/activity-catalog-view-model";

export type PlanningBlockActivities = Record<TrainingPlanBlockKey, TrainingPlanActivity[]>;

export type PlanningBlockText = Record<TrainingPlanBlockKey, string>;

export const planningBlockKeys: TrainingPlanBlockKey[] = ["warmup", "main", "cooldown"];

const blockStage: Record<TrainingPlanBlockKey, TrainingPlanActivity["stage"]> = {
  warmup: "warmup",
  main: "drill",
  cooldown: "cooldown",
};

const emptyBlock = (): TrainingPlanSessionBlock => ({
  summary: "",
  activities: [],
});

const toLines = (value: string | string[] | null | undefined) =>
  (Array.isArray(value) ? value.join("\n") : String(value ?? ""))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export const createEmptyPlanningBlockActivities = (): PlanningBlockActivities => ({
  warmup: [],
  main: [],
  cooldown: [],
});

export const getPlanningBlockLabel = (blockKey: TrainingPlanBlockKey) => {
  if (blockKey === "warmup") return "Aquecimento";
  if (blockKey === "main") return "Parte principal";
  return "Volta à calma";
};

export const buildTrainingPlanActivityFromCatalogItem = (
  item: ActivityCatalogListItem,
  blockKey: TrainingPlanBlockKey,
  addedAt: string
): TrainingPlanActivity => {
  const { variant } = item;
  const taxonomy = variant.taxonomy;
  return {
    name: variant.name,
    description: item.purpose,
    stage: blockStage[blockKey] ?? taxonomy.recommendedPhase,
    participants: variant.players,
    organization: variant.setup,
    starter: variant.starter,
    action: variant.action,
    rotation: variant.rotation,
    simpleRule: variant.constraint,
    scoring: variant.scoring,
    materials: variant.materials,
    space: variant.space,
    coachFocus: `${skillLabels[taxonomy.skill]} · ${phaseLabels[taxonomy.recommendedPhase]}`,
    adaptation: variant.adaptations?.join("; "),
    primarySkill: taxonomy.skill,
    objective: item.purpose,
    constraints: variant.avoid,
    progression: variant.progression,
    catalog: {
      source: "goAtletaCatalog",
      familyId: item.family.id,
      variantId: variant.id,
      addedAt,
    },
  };
};

export const buildTrainingPlanActivityFromExerciseLink = (
  exercise: Exercise
): TrainingPlanActivity => {
  const title = exercise.title.trim() || "Vídeo/link";
  const descriptionParts = [
    exercise.description?.trim(),
    exercise.notes?.trim(),
    exercise.videoUrl ? `Link: ${exercise.videoUrl}` : "",
  ].filter(Boolean);
  return {
    name: title,
    description: descriptionParts.join("\n"),
    execution: exercise.videoUrl,
    coachFocus: exercise.source ? `Vídeo/link · ${exercise.source}` : "Vídeo/link",
  };
};

export const addPlanningActivityToBlock = (
  current: PlanningBlockActivities,
  blockKey: TrainingPlanBlockKey,
  activity: TrainingPlanActivity
): { activities: PlanningBlockActivities; added: boolean } => {
  const blockActivities = current[blockKey] ?? [];
  const alreadyExists = hasMatchingTrainingPlanActivity(blockActivities, activity);
  if (alreadyExists) return { activities: current, added: false };
  return {
    added: true,
    activities: {
      ...current,
      [blockKey]: [...blockActivities, activity],
    },
  };
};

export const removePlanningActivityFromBlock = (
  current: PlanningBlockActivities,
  blockKey: TrainingPlanBlockKey,
  index: number
): PlanningBlockActivities => ({
  ...current,
  [blockKey]: (current[blockKey] ?? []).filter((_, itemIndex) => itemIndex !== index),
});

export const legacyTextToActivities = (
  value: string,
  blockKey: TrainingPlanBlockKey
): TrainingPlanActivity[] =>
  toLines(value).map((name) => ({
    name,
    description: "",
    stage: blockStage[blockKey],
  }));

export const buildPlanningActivitiesFromLegacyLines = (
  lines: Record<TrainingPlanBlockKey, string[]>
): PlanningBlockActivities => ({
  warmup: legacyTextToActivities(lines.warmup.join("\n"), "warmup"),
  main: legacyTextToActivities(lines.main.join("\n"), "main"),
  cooldown: legacyTextToActivities(lines.cooldown.join("\n"), "cooldown"),
});

export const hydratePlanningActivitiesFromPlan = (
  plan: TrainingPlan | null | undefined
): PlanningBlockActivities => {
  const next = createEmptyPlanningBlockActivities();
  if (!plan) return next;
  planningBlockKeys.forEach((blockKey) => {
    next[blockKey] = resolveTrainingPlanBlock(plan, blockKey).activities.map((activity) => ({
      ...activity,
    }));
  });
  return next;
};

export const syncLegacyLinesFromBlocks = (
  blocks: PlanningBlockActivities
): Record<TrainingPlanBlockKey, string[]> => ({
  warmup: (blocks.warmup ?? []).map((activity) => activity.name).filter(Boolean),
  main: (blocks.main ?? []).map((activity) => activity.name).filter(Boolean),
  cooldown: (blocks.cooldown ?? []).map((activity) => activity.name).filter(Boolean),
});

const mergeManualTextIntoActivities = (
  activities: TrainingPlanActivity[],
  text: string,
  blockKey: TrainingPlanBlockKey
) => {
  const next = [...activities];
  legacyTextToActivities(text, blockKey).forEach((activity) => {
    if (!hasMatchingTrainingPlanActivity(next, activity)) {
      next.push(activity);
    }
  });
  return next;
};

export const buildPedagogyBlocksFromPlanningForm = ({
  currentPedagogy,
  blockActivities,
  blockText,
}: {
  currentPedagogy?: TrainingPlanPedagogy;
  blockActivities: PlanningBlockActivities;
  blockText: PlanningBlockText;
}): TrainingPlanPedagogy => ({
  ...(currentPedagogy ?? {}),
  blocks: {
    warmup: {
      ...(currentPedagogy?.blocks?.warmup ?? emptyBlock()),
      activities: mergeManualTextIntoActivities(
        blockActivities.warmup ?? [],
        blockText.warmup,
        "warmup"
      ),
    },
    main: {
      ...(currentPedagogy?.blocks?.main ?? emptyBlock()),
      activities: mergeManualTextIntoActivities(
        blockActivities.main ?? [],
        blockText.main,
        "main"
      ),
    },
    cooldown: {
      ...(currentPedagogy?.blocks?.cooldown ?? emptyBlock()),
      activities: mergeManualTextIntoActivities(
        blockActivities.cooldown ?? [],
        blockText.cooldown,
        "cooldown"
      ),
    },
  },
});
