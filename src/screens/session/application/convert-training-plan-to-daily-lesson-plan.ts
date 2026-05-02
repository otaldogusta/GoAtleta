import type {
  ClassGroup,
  ClassPlan,
  DailyLessonPlan,
  LessonActivity,
  LessonBlock,
  SessionEnvironment,
  TrainingPlan,
  TrainingPlanSessionBlock,
} from "../../../core/models";
import { serializeLessonBlocks } from "../../planning/application/daily-lesson-blocks";

const safeText = (value: unknown) => String(value ?? "").trim();

const parseMinutes = (value: string | undefined, fallback: number) => {
  const match = safeText(value).match(/\d+/);
  if (!match) return fallback;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const inferEnvironmentFromTrainingPlan = (plan: TrainingPlan): SessionEnvironment => {
  const text = [
    plan.title,
    ...(plan.tags ?? []),
    ...(plan.warmup ?? []),
    ...(plan.main ?? []),
    ...(plan.cooldown ?? []),
  ]
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (text.includes("academia") || text.includes("resistido")) return "academia";
  if (text.includes("mista") || text.includes("transferencia")) return "mista";
  return "quadra";
};

const activityFromText = (text: string, index: number): LessonActivity | null => {
  const cleaned = safeText(text);
  if (!cleaned) return null;
  const [firstLine, ...rest] = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return {
    id: `applied_${index}`,
    name: firstLine || cleaned,
    description: rest.length ? rest.join("\n") : cleaned,
  };
};

const activitiesFromSessionBlock = (
  block: TrainingPlanSessionBlock | undefined,
  fallbackItems: string[],
): LessonActivity[] => {
  const structured = (block?.activities ?? [])
    .map((activity, index): LessonActivity | null => {
      const name = safeText(activity.name);
      const description = safeText(activity.description || activity.objective || activity.progression);
      if (!name && !description) return null;
      return {
        id: `applied_structured_${index}`,
        name: name || description,
        description: description || name,
      };
    })
    .filter((activity: LessonActivity | null): activity is LessonActivity => Boolean(activity));

  if (structured.length) return structured;

  return fallbackItems
    .map(activityFromText)
    .filter((activity: LessonActivity | null): activity is LessonActivity => Boolean(activity));
};

const blockToText = (block: LessonBlock): string =>
  (block.activities ?? [])
    .map((activity) => {
      const name = safeText(activity.name);
      const description = safeText(activity.description);
      if (name && description && name !== description) return `${name}\n${description}`;
      return description || name;
    })
    .filter(Boolean)
    .join("\n\n");

export function convertTrainingPlanToDailyLessonPlan(input: {
  trainingPlan: TrainingPlan;
  classGroup: ClassGroup;
  classPlan: ClassPlan;
  existingDailyPlan?: DailyLessonPlan | null;
  sessionDate: string;
  weekdayId: number;
  nowIso: string;
}): DailyLessonPlan {
  const {
    trainingPlan,
    classGroup,
    classPlan,
    existingDailyPlan,
    sessionDate,
    weekdayId,
    nowIso,
  } = input;
  const environment = inferEnvironmentFromTrainingPlan(trainingPlan);
  const blocks: LessonBlock[] = [
    {
      key: "warmup",
      label: "Aquecimento",
      durationMinutes: parseMinutes(trainingPlan.warmupTime, 10),
      activities: activitiesFromSessionBlock(trainingPlan.pedagogy?.blocks?.warmup, trainingPlan.warmup),
    },
    {
      key: "main",
      label: "Parte principal",
      durationMinutes: parseMinutes(trainingPlan.mainTime, 45),
      activities: activitiesFromSessionBlock(trainingPlan.pedagogy?.blocks?.main, trainingPlan.main),
    },
    {
      key: "cooldown",
      label: "Volta à calma",
      durationMinutes: parseMinutes(trainingPlan.cooldownTime, 5),
      activities: activitiesFromSessionBlock(trainingPlan.pedagogy?.blocks?.cooldown, trainingPlan.cooldown),
    },
  ];

  const warmup = blockToText(blocks[0]);
  const mainPart = blockToText(blocks[1]);
  const cooldown = blockToText(blocks[2]);
  const objective = safeText(trainingPlan.pedagogy?.sessionObjective);
  const focus = safeText(trainingPlan.pedagogy?.learningObjectives?.specific?.[0]);
  const successCriteria = safeText(trainingPlan.pedagogy?.learningObjectives?.successCriteria?.[0]);

  return {
    id: existingDailyPlan?.id ?? `daily_apply_${classGroup.id}_${sessionDate}`,
    classId: classGroup.id,
    weeklyPlanId: classPlan.id,
    date: sessionDate,
    dayOfWeek: weekdayId,
    title: trainingPlan.title,
    blocksJson: serializeLessonBlocks(blocks),
    sessionEnvironment: environment,
    sessionPrimaryComponent:
      environment === "academia"
        ? "resistido"
        : environment === "mista"
          ? "misto_transferencia"
          : "tecnico_tatico",
    warmup,
    mainPart,
    cooldown,
    observations: [
      objective ? `Objetivo da aula: ${objective}` : "",
      focus ? `Foco da aula: ${focus}` : "",
      successCriteria ? `Critério de sucesso: ${successCriteria}` : "",
      `Origem: treino salvo aplicado pelo professor (${trainingPlan.id}).`,
    ]
      .filter(Boolean)
      .join("\n"),
    generationVersion: (existingDailyPlan?.generationVersion ?? 0) + 1,
    derivedFromWeeklyVersion: classPlan.generationVersion ?? existingDailyPlan?.derivedFromWeeklyVersion ?? 1,
    generationModelVersion: "manual-training-plan-apply",
    generationContextSnapshotJson: JSON.stringify({
      source: "training_plan_apply",
      trainingPlanId: trainingPlan.id,
      parentPlanId: trainingPlan.parentPlanId,
      classPlanId: classPlan.id,
    }),
    syncStatus: "overridden",
    outOfSyncReasonsJson: "[]",
    manualOverridesJson: JSON.stringify({
      source: "training_plan",
      trainingPlanId: trainingPlan.id,
      appliedAt: nowIso,
    }),
    manualOverrideMaskJson: JSON.stringify(["title", "warmup", "mainPart", "cooldown", "observations"]),
    lastAutoGeneratedAt: existingDailyPlan?.lastAutoGeneratedAt,
    lastManualEditedAt: nowIso,
    createdAt: existingDailyPlan?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
}
