import type {
  ClassGroup,
  TrainingPlan,
  TrainingPlanActivity,
  TrainingPlanPedagogy,
} from "../../core/models";
import { createTrainingPlanVersion } from "../../core/training-plan-factory";
import type { TrainingPlanBlockKey } from "../../core/training-plan-blocks";
import {
  getClasses,
  getLatestTrainingPlanByClass,
  getTrainingPlans,
  saveTrainingPlan,
} from "../../db/seed";
import { phaseLabels, skillLabels } from "./activity-catalog-labels";
import type { ActivityCatalogListItem } from "./activity-catalog-view-model";

export type CatalogLessonDestination = {
  id: string;
  label: string;
  detail: string;
  date: string;
  classGroup: ClassGroup;
  plan: TrainingPlan;
};

const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatShortDate = (value: string) => {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}`;
};

const planTimestamp = (plan: TrainingPlan) => {
  const parsed = Date.parse(plan.createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickLatestPlanPerClassDate = (plans: TrainingPlan[]) => {
  const map = new Map<string, TrainingPlan>();
  plans.forEach((plan) => {
    const key = `${plan.classId}:${plan.applyDate ?? ""}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, plan);
      return;
    }
    const versionDiff = (plan.version ?? 0) - (current.version ?? 0);
    if (versionDiff > 0 || (versionDiff === 0 && planTimestamp(plan) > planTimestamp(current))) {
      map.set(key, plan);
    }
  });
  return Array.from(map.values());
};

export const loadCatalogLessonDestinations = async (
  today = toLocalIsoDate(new Date())
): Promise<CatalogLessonDestination[]> => {
  const [classes, todayPlans, recentPlans] = await Promise.all([
    getClasses(),
    getTrainingPlans({ applyDate: today, status: "final", orderBy: "version_desc", limit: 40 }),
    getTrainingPlans({ status: "final", orderBy: "createdat_desc", limit: 120 }),
  ]);

  const classById = new Map(classes.map((classGroup) => [classGroup.id, classGroup]));
  const datedPlans = pickLatestPlanPerClassDate(
    [...todayPlans, ...recentPlans].filter((plan) => {
      const applyDate = String(plan.applyDate ?? "");
      return /^\d{4}-\d{2}-\d{2}$/.test(applyDate) && applyDate >= today;
    })
  ).sort((a, b) => {
    const dateDiff = String(a.applyDate ?? "").localeCompare(String(b.applyDate ?? ""));
    if (dateDiff !== 0) return dateDiff;
    return planTimestamp(b) - planTimestamp(a);
  });

  return datedPlans
    .map((plan): CatalogLessonDestination | null => {
      const classGroup = classById.get(plan.classId);
      const date = String(plan.applyDate ?? "");
      if (!classGroup || !date) return null;
      const isToday = date === today;
      return {
        id: `${plan.id}:${date}`,
        label: `${isToday ? "Aula de hoje" : "Próxima aula planejada"} · ${classGroup.name}`,
        detail: `${formatShortDate(date)} · ${plan.title || "Plano aplicado"}`,
        date,
        classGroup,
        plan,
      };
    })
    .filter((destination): destination is CatalogLessonDestination => Boolean(destination))
    .slice(0, 8);
};

const pickCatalogActivityBlock = (item: ActivityCatalogListItem): TrainingPlanBlockKey => {
  const phase = item.variant.taxonomy.recommendedPhase;
  if (phase === "warmup") return "warmup";
  if (phase === "cooldown") return "cooldown";
  return "main";
};

const buildCatalogTrainingActivity = (
  item: ActivityCatalogListItem
): TrainingPlanActivity => {
  const { variant } = item;
  const taxonomy = variant.taxonomy;
  return {
    name: variant.name,
    description: item.purpose,
    stage: taxonomy.recommendedPhase,
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
  };
};

const emptyBlock = () => ({ summary: "", activities: [] as TrainingPlanActivity[] });

const buildPedagogyWithCatalogActivity = (
  plan: TrainingPlan,
  item: ActivityCatalogListItem
): TrainingPlanPedagogy => {
  const blockKey = pickCatalogActivityBlock(item);
  const activity = buildCatalogTrainingActivity(item);
  const currentBlocks = plan.pedagogy?.blocks ?? {
    warmup: emptyBlock(),
    main: emptyBlock(),
    cooldown: emptyBlock(),
  };
  const block = currentBlocks[blockKey] ?? emptyBlock();
  const alreadyExists = block.activities.some(
    (existing) =>
      existing.name.trim().toLowerCase() === activity.name.trim().toLowerCase()
  );
  const nextActivities = alreadyExists
    ? block.activities
    : [...block.activities, activity];

  return {
    ...(plan.pedagogy ?? {}),
    blocks: {
      warmup: currentBlocks.warmup ?? emptyBlock(),
      main: currentBlocks.main ?? emptyBlock(),
      cooldown: currentBlocks.cooldown ?? emptyBlock(),
      [blockKey]: {
        ...block,
        activities: nextActivities,
      },
    },
  };
};

const buildDraftWithCatalogActivity = (
  plan: TrainingPlan,
  item: ActivityCatalogListItem
) => {
  const blockKey = pickCatalogActivityBlock(item);
  const appendUnique = (values: string[]) =>
    values.some((value) => value.trim().toLowerCase() === item.variant.name.trim().toLowerCase())
      ? values
      : [...values, item.variant.name];

  return {
    title: plan.title,
    tags: plan.tags,
    warmup: blockKey === "warmup" ? appendUnique(plan.warmup ?? []) : plan.warmup,
    main: blockKey === "main" ? appendUnique(plan.main ?? []) : plan.main,
    cooldown: blockKey === "cooldown" ? appendUnique(plan.cooldown ?? []) : plan.cooldown,
    warmupTime: plan.warmupTime,
    mainTime: plan.mainTime,
    cooldownTime: plan.cooldownTime,
  };
};

export const addCatalogActivityToLesson = async (
  destination: CatalogLessonDestination,
  item: ActivityCatalogListItem
) => {
  const nowIso = new Date().toISOString();
  const latestVersionPlan = await getLatestTrainingPlanByClass(destination.classGroup.id, {
    organizationId: destination.classGroup.organizationId ?? null,
  });
  const latestVersion = latestVersionPlan?.version ?? 0;
  const nextPlan = createTrainingPlanVersion({
    classId: destination.classGroup.id,
    version: Math.max(destination.plan.version ?? 0, latestVersion) + 1,
    origin: "manual",
    draft: buildDraftWithCatalogActivity(destination.plan, item),
    applyDays: [],
    applyDate: destination.date,
    inputHash: destination.plan.inputHash,
    nowIso,
    idPrefix: "plan_catalog",
    status: "final",
    generatedAt: destination.plan.generatedAt,
    finalizedAt: nowIso,
    parentPlanId: destination.plan.parentPlanId ?? destination.plan.id,
    previousVersionId: destination.plan.id,
    pedagogy: buildPedagogyWithCatalogActivity(destination.plan, item),
  });
  await saveTrainingPlan(nextPlan, {
    organizationId: destination.classGroup.organizationId,
  });
  return nextPlan;
};
