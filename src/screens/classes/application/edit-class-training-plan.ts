import type {
  TrainingPlan,
  TrainingPlanActivity,
} from "../../../core/models";
import {
  resolveTrainingPlanBlock,
  type TrainingPlanBlockKey,
} from "../../../core/training-plan-blocks";

export type ClassPlanBlockDraft = {
  duration: string;
  objective: string;
  activities: TrainingPlanActivity[];
};

export const appendClassPlanActivity = (
  draft: ClassPlanBlockDraft
): ClassPlanBlockDraft => {
  const existingNames = new Set(
    draft.activities.map((activity) => String(activity.name ?? "").trim().toLocaleLowerCase("pt-BR"))
  );
  let suffix = 1;
  let name = "Nova atividade";

  while (existingNames.has(name.toLocaleLowerCase("pt-BR"))) {
    suffix += 1;
    name = `Nova atividade ${suffix}`;
  }

  return {
    ...draft,
    activities: [...draft.activities, { name, description: "" }],
  };
};

const durationFieldByBlock: Record<
  TrainingPlanBlockKey,
  "warmupTime" | "mainTime" | "cooldownTime"
> = {
  warmup: "warmupTime",
  main: "mainTime",
  cooldown: "cooldownTime",
};

const legacyFieldByBlock: Record<
  TrainingPlanBlockKey,
  "warmup" | "main" | "cooldown"
> = {
  warmup: "warmup",
  main: "main",
  cooldown: "cooldown",
};

export const buildClassPlanBlockDraft = (
  plan: TrainingPlan,
  blockKey: TrainingPlanBlockKey
): ClassPlanBlockDraft => {
  const block = resolveTrainingPlanBlock(plan, blockKey);
  return {
    duration: plan[durationFieldByBlock[blockKey]],
    objective: block.summary,
    activities: block.activities.map((activity) => ({ ...activity })),
  };
};

export const updateClassTrainingPlanBlock = (
  plan: TrainingPlan,
  blockKey: TrainingPlanBlockKey,
  draft: ClassPlanBlockDraft
): TrainingPlan => {
  const durationField = durationFieldByBlock[blockKey];
  const legacyField = legacyFieldByBlock[blockKey];
  const activities = draft.activities
    .map((activity) => ({
      ...activity,
      name: String(activity.name ?? "").trim(),
      description: String(activity.description ?? "").trim(),
    }))
    .filter((activity) => activity.name);
  const blocks = {
    warmup: {
      summary: resolveTrainingPlanBlock(plan, "warmup").summary,
      activities: resolveTrainingPlanBlock(plan, "warmup").activities.map((activity) => ({ ...activity })),
    },
    main: {
      summary: resolveTrainingPlanBlock(plan, "main").summary,
      activities: resolveTrainingPlanBlock(plan, "main").activities.map((activity) => ({ ...activity })),
    },
    cooldown: {
      summary: resolveTrainingPlanBlock(plan, "cooldown").summary,
      activities: resolveTrainingPlanBlock(plan, "cooldown").activities.map((activity) => ({ ...activity })),
    },
  };

  blocks[blockKey] = {
    summary: draft.objective.trim(),
    activities,
  };

  return {
    ...plan,
    [durationField]: draft.duration.trim(),
    [legacyField]: activities.map((activity) => activity.name),
    pedagogy: {
      ...(plan.pedagogy ?? {}),
      blocks,
    },
  };
};
