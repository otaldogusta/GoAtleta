// ---------------------------------------------------------------------------
// Training plans + templates + exercises domain module
// ---------------------------------------------------------------------------

import { normalizeAgeBand } from "../core/age-band";
import type { Exercise, HiddenTemplate, TrainingPlan, TrainingTemplate } from "../core/models";
import {
  CACHE_KEYS,
  getActiveOrganizationId,
  isNetworkError,
  readCache,
  supabaseDelete,
  supabaseGet,
  supabasePatch,
  supabasePost,
  writeCache,
} from "./client";
import type { ExerciseRow, HiddenTemplateRow, TrainingPlanRow, TrainingTemplateRow } from "./row-types";

// ---------------------------------------------------------------------------
// Training plans
// ---------------------------------------------------------------------------

export async function getTrainingPlans(
  options: { organizationId?: string | null; classId?: string | null } = {}
): Promise<TrainingPlan[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const classId = options.classId?.trim() || "";
    const rows = await supabaseGet<TrainingPlanRow[]>(
      organizationId
        ? `/training_plans?select=*&organization_id=eq.${encodeURIComponent(organizationId)}${
            classId ? `&classid=eq.${encodeURIComponent(classId)}` : ""
          }&order=createdat.desc`
        : "/training_plans?select=*&order=createdat.desc"
    );
    const mapped = rows.map((row) => ({
      id: row.id,
      classId: row.classid,
      title: row.title,
      tags: row.tags ?? [],
      warmup: row.warmup ?? [],
      main: row.main ?? [],
      cooldown: row.cooldown ?? [],
      warmupTime: row.warmuptime ?? "",
      mainTime: row.maintime ?? "",
      cooldownTime: row.cooldowntime ?? "",
      applyDays: row.applydays ?? [],
      applyDate: row.applydate ?? "",
      createdAt: row.createdat,
    }));
    if (!classId) {
      await writeCache(CACHE_KEYS.trainingPlans, mapped);
    }
    return mapped;
  } catch (error) {
    if (isNetworkError(error)) {
      const cached = await readCache<TrainingPlan[]>(CACHE_KEYS.trainingPlans);
      if (cached) {
        const classId = options.classId?.trim() || "";
        return classId ? cached.filter((plan) => plan.classId === classId) : cached;
      }
    }
    throw error;
  }
}

export async function saveTrainingPlan(plan: TrainingPlan, options?: { organizationId?: string }) {
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  await supabasePost("/training_plans", [
    {
      id: plan.id,
      classid: plan.classId,
      organization_id: organizationId ?? undefined,
      title: plan.title,
      tags: plan.tags ?? [],
      warmup: plan.warmup,
      main: plan.main,
      cooldown: plan.cooldown,
      warmuptime: plan.warmupTime,
      maintime: plan.mainTime,
      cooldowntime: plan.cooldownTime,
      applydays: plan.applyDays ?? [],
      applydate: plan.applyDate ? plan.applyDate : null,
      createdat: plan.createdAt,
    },
  ]);
}

export async function updateTrainingPlan(plan: TrainingPlan, options?: { organizationId?: string }) {
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  await supabasePatch(
    organizationId
      ? "/training_plans?id=eq." +
          encodeURIComponent(plan.id) +
          "&organization_id=eq." +
          encodeURIComponent(organizationId)
      : "/training_plans?id=eq." + encodeURIComponent(plan.id),
    {
      classid: plan.classId,
      organization_id: organizationId ?? undefined,
      title: plan.title,
      tags: plan.tags ?? [],
      warmup: plan.warmup,
      main: plan.main,
      cooldown: plan.cooldown,
      warmuptime: plan.warmupTime,
      maintime: plan.mainTime,
      cooldowntime: plan.cooldownTime,
      applydays: plan.applyDays ?? [],
      applydate: plan.applyDate ? plan.applyDate : null,
      createdat: plan.createdAt,
    }
  );
}

export async function deleteTrainingPlan(
  id: string,
  options?: { organizationId?: string | null }
) {
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  await supabaseDelete(
    organizationId
      ? "/training_plans?id=eq." +
          encodeURIComponent(id) +
          "&organization_id=eq." +
          encodeURIComponent(organizationId)
      : "/training_plans?id=eq." + encodeURIComponent(id)
  );
}

export async function deleteTrainingPlansByClassAndDate(
  classId: string,
  date: string,
  options?: { organizationId?: string | null }
) {
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  await supabaseDelete(
    "/training_plans?classid=eq." +
      encodeURIComponent(classId) +
      "&applydate=eq." +
      encodeURIComponent(date) +
      (organizationId
        ? "&organization_id=eq." + encodeURIComponent(organizationId)
        : "")
  );
}

export async function getLatestTrainingPlanByClass(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<TrainingPlan | null> {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());
  const rows = await supabaseGet<TrainingPlanRow[]>(
    organizationId
      ? "/training_plans?select=*&classid=eq." +
          encodeURIComponent(classId) +
          "&organization_id=eq." +
          encodeURIComponent(organizationId) +
          "&order=createdat.desc&limit=1"
      : "/training_plans?select=*&classid=eq." +
          encodeURIComponent(classId) +
          "&order=createdat.desc&limit=1"
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    classId: row.classid,
    title: row.title,
    tags: row.tags ?? [],
    warmup: row.warmup ?? [],
    main: row.main ?? [],
    cooldown: row.cooldown ?? [],
    warmupTime: row.warmuptime ?? "",
    mainTime: row.maintime ?? "",
    cooldownTime: row.cooldowntime ?? "",
    applyDays: row.applydays ?? [],
    applyDate: row.applydate ?? "",
    createdAt: row.createdat,
  };
}

// ---------------------------------------------------------------------------
// Training templates
// ---------------------------------------------------------------------------

export async function getTrainingTemplates(): Promise<TrainingTemplate[]> {
  try {
    const rows = await supabaseGet<TrainingTemplateRow[]>(
      "/training_templates?select=*&order=createdat.desc"
    );
    const mapped = rows.map((row) => ({
      id: row.id,
      title: row.title,
      ageBand: normalizeAgeBand(row.ageband),
      tags: row.tags ?? [],
      warmup: row.warmup ?? [],
      main: row.main ?? [],
      cooldown: row.cooldown ?? [],
      warmupTime: row.warmuptime ?? "",
      mainTime: row.maintime ?? "",
      cooldownTime: row.cooldowntime ?? "",
      createdAt: row.createdat,
    }));
    await writeCache(CACHE_KEYS.trainingTemplates, mapped);
    return mapped;
  } catch (error) {
    if (isNetworkError(error)) {
      const cached = await readCache<TrainingTemplate[]>(CACHE_KEYS.trainingTemplates);
      if (cached) return cached;
    }
    throw error;
  }
}

export async function saveTrainingTemplate(template: TrainingTemplate) {
  await supabasePost("/training_templates", [
    {
      id: template.id,
      title: template.title,
      ageband: normalizeAgeBand(template.ageBand),
      tags: template.tags ?? [],
      warmup: template.warmup,
      main: template.main,
      cooldown: template.cooldown,
      warmuptime: template.warmupTime,
      maintime: template.mainTime,
      cooldowntime: template.cooldownTime,
      createdat: template.createdAt,
    },
  ]);
}

export async function updateTrainingTemplate(template: TrainingTemplate) {
  await supabasePatch(
    "/training_templates?id=eq." + encodeURIComponent(template.id),
    {
      title: template.title,
      ageband: normalizeAgeBand(template.ageBand),
      tags: template.tags ?? [],
      warmup: template.warmup,
      main: template.main,
      cooldown: template.cooldown,
      warmuptime: template.warmupTime,
      maintime: template.mainTime,
      cooldowntime: template.cooldownTime,
      createdat: template.createdAt,
    }
  );
}

export async function deleteTrainingTemplate(id: string) {
  await supabaseDelete(
    "/training_templates?id=eq." + encodeURIComponent(id)
  );
}

export async function getHiddenTemplates(): Promise<HiddenTemplate[]> {
  const rows = await supabaseGet<HiddenTemplateRow[]>(
    "/training_template_hides?select=*"
  );
  return rows.map((row) => ({
    id: row.id,
    templateId: row.templateid,
    createdAt: row.createdat,
  }));
}

export async function hideTrainingTemplate(templateId: string) {
  await supabasePost("/training_template_hides", [
    {
      id: "hide_" + Date.now(),
      templateid: templateId,
      createdat: new Date().toISOString(),
    },
  ]);
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export async function getExercises(): Promise<Exercise[]> {
  const rows = await supabaseGet<ExerciseRow[]>(
    "/exercises?select=*&order=createdat.desc"
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    tags: row.tags ?? [],
    videoUrl: row.videourl ?? "",
    source: row.source ?? "",
    description: row.description ?? "",
    publishedAt: row.publishedat ?? "",
    notes: row.notes ?? "",
    createdAt: row.createdat,
  }));
}

export async function saveExercise(exercise: Exercise) {
  await supabasePost("/exercises", [
    {
      id: exercise.id,
      title: exercise.title,
      tags: exercise.tags ?? [],
      videourl: exercise.videoUrl ?? "",
      source: exercise.source ?? "",
      description: exercise.description ?? "",
      publishedat: exercise.publishedAt ?? "",
      notes: exercise.notes ?? "",
      createdat: exercise.createdAt,
    },
  ]);
}

export async function updateExercise(exercise: Exercise) {
  await supabasePatch(
    "/exercises?id=eq." + encodeURIComponent(exercise.id),
    {
      title: exercise.title,
      tags: exercise.tags ?? [],
      videourl: exercise.videoUrl ?? "",
      source: exercise.source ?? "",
      description: exercise.description ?? "",
      publishedat: exercise.publishedAt ?? "",
      notes: exercise.notes ?? "",
      createdat: exercise.createdAt,
    }
  );
}

export async function deleteExercise(id: string) {
  await supabaseDelete(
    "/exercises?id=eq." + encodeURIComponent(id)
  );
}
