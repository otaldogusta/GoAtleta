// ---------------------------------------------------------------------------
// Training plans + templates + exercises domain module
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/react-native";
import { normalizeAgeBand } from "../core/age-band";
import type { Exercise, HiddenTemplate, TrainingPlan, TrainingTemplate } from "../core/models";
import {
  CACHE_KEYS,
  getActiveOrganizationId,
  isAuthError,
  isNetworkError,
  readCache,
  supabaseDelete,
  supabaseGet,
  supabasePatch,
  supabasePost,
  writeCache,
} from "./client";
import type { ExerciseRow, HiddenTemplateRow, TrainingPlanRow, TrainingTemplateRow } from "./row-types";

const mapTrainingPlanRow = (row: TrainingPlanRow): TrainingPlan => ({
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
  version: typeof row.version === "number" ? row.version : undefined,
  status: row.status ?? undefined,
  origin: row.origin ?? undefined,
  inputHash: row.inputhash ?? undefined,
  generatedAt: row.generatedat ?? undefined,
  finalizedAt: row.finalizedat ?? undefined,
  parentPlanId: (row as { parent_plan_id?: string | null }).parent_plan_id ?? undefined,
  previousVersionId: (row as { previous_version_id?: string | null }).previous_version_id ?? undefined,
  pedagogy: (row as { pedagogy?: unknown }).pedagogy
    ? ((row as { pedagogy?: unknown }).pedagogy as TrainingPlan["pedagogy"])
    : undefined,
});

const getPlanTimestamp = (plan: TrainingPlan) => {
  const value = Date.parse(plan.createdAt);
  return Number.isNaN(value) ? 0 : value;
};

const pickLatestFinalTrainingPlan = (plans: TrainingPlan[]): TrainingPlan | null => {
  const finalPlans = plans.filter((plan) => plan.status !== "generated");
  if (!finalPlans.length) return null;
  const sorted = [...finalPlans].sort((a, b) => {
    const versionDiff = (b.version ?? 0) - (a.version ?? 0);
    if (versionDiff !== 0) return versionDiff;
    return getPlanTimestamp(b) - getPlanTimestamp(a);
  });
  return sorted[0] ?? null;
};

const buildTrainingPlanBasePayload = (
  plan: TrainingPlan,
  organizationId: string | null
) => ({
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
});

const buildTrainingPlanVersionedPayload = (
  plan: TrainingPlan,
  organizationId: string | null
) => ({
  ...buildTrainingPlanBasePayload(plan, organizationId),
  version: typeof plan.version === "number" ? plan.version : null,
  status: plan.status ?? null,
  origin: plan.origin ?? null,
  inputhash: plan.inputHash ?? null,
  generatedat: plan.generatedAt ?? null,
  finalizedat: plan.finalizedAt ?? null,
  parent_plan_id: plan.parentPlanId ?? null,
  previous_version_id: plan.previousVersionId ?? null,
  pedagogy: plan.pedagogy ?? null,
});

const isMissingVersioningColumnError = (error: unknown) => {
  const message = String(error ?? "").toLowerCase();
  if (!message.includes("column")) return false;
  return (
    message.includes("version") ||
    message.includes("status") ||
    message.includes("origin") ||
    message.includes("inputhash") ||
    message.includes("generatedat") ||
    message.includes("finalizedat")
  );
};

const isMissingVersioningReadError = (error: unknown) => {
  const message = String(error ?? "").toLowerCase();
  if (!message.includes("column")) return false;
  return message.includes("version") || message.includes("status");
};

type TrainingPlansOrderBy = "createdat_desc" | "version_desc";

type TrainingPlansQueryOptions = {
  organizationId?: string | null;
  classId?: string | null;
  status?: "generated" | "final";
  applyDate?: string;
  applyWeekday?: number;
  orderBy?: TrainingPlansOrderBy;
  limit?: number;
};

const buildTrainingPlansEndpoint = (
  organizationId: string | null,
  options: {
    classId: string;
    status?: "generated" | "final";
    applyDate?: string;
    applyWeekday?: number;
    orderBy: TrainingPlansOrderBy;
    limit?: number;
  }
) => {
  const query: string[] = ["select=*"];
  if (organizationId) {
    query.push(`organization_id=eq.${encodeURIComponent(organizationId)}`);
  }
  if (options.classId) {
    query.push(`classid=eq.${encodeURIComponent(options.classId)}`);
  }
  if (options.status) {
    query.push(`status=eq.${encodeURIComponent(options.status)}`);
  }
  if (options.applyDate) {
    query.push(`applydate=eq.${encodeURIComponent(options.applyDate)}`);
  }
  if (typeof options.applyWeekday === "number" && Number.isFinite(options.applyWeekday)) {
    query.push(`applydays=cs.${encodeURIComponent(`{${Math.floor(options.applyWeekday)}}`)}`);
  }
  if (options.orderBy === "version_desc") {
    query.push("order=version.desc,createdat.desc");
  } else {
    query.push("order=createdat.desc");
  }
  if (typeof options.limit === "number" && options.limit > 0) {
    query.push(`limit=${Math.floor(options.limit)}`);
  }
  return `/training_plans?${query.join("&")}`;
};

const logVersioningSchemaFallback = (operation: "insert" | "update", error: unknown) => {
  const message = String(error ?? "");
  console.warn(`[TrainingPlan] versioning schema fallback (${operation})`, message);
  Sentry.addBreadcrumb({
    category: "training-plan",
    level: "warning",
    message: "Training plan versioning fallback used",
    data: {
      operation,
      reason: message,
    },
  });
};

// ---------------------------------------------------------------------------
// Training plans
// ---------------------------------------------------------------------------

export async function getTrainingPlans(
  options: TrainingPlansQueryOptions = {}
): Promise<TrainingPlan[]> {
  const applyStatusFilter = (
    plans: TrainingPlan[],
    status: TrainingPlansQueryOptions["status"]
  ) => {
    if (!status) return plans;
    if (status === "final") {
      return plans.filter((plan) => plan.status !== "generated");
    }
    return plans.filter((plan) => plan.status === "generated");
  };

  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const classId = options.classId?.trim() || "";
    const orderBy = options.orderBy ?? "createdat_desc";
    const status = options.status;
    const applyDate = options.applyDate?.trim() || undefined;
    const applyWeekday = options.applyWeekday;
    const limit = options.limit;
    const endpoint = buildTrainingPlansEndpoint(organizationId, {
      classId,
      status,
      applyDate,
      applyWeekday,
      orderBy,
      limit,
    });
    let rows: TrainingPlanRow[];
    try {
      rows = await supabaseGet<TrainingPlanRow[]>(endpoint);
    } catch (error) {
      if (!isMissingVersioningReadError(error)) throw error;
      const fallbackEndpoint = buildTrainingPlansEndpoint(organizationId, {
        classId,
        applyDate,
        applyWeekday,
        orderBy: "createdat_desc",
        limit,
      });
      rows = await supabaseGet<TrainingPlanRow[]>(fallbackEndpoint);
    }
    const mapped = rows.map(mapTrainingPlanRow);
    const filtered = applyStatusFilter(mapped, status);
    const canCache =
      !classId &&
      !status &&
      !applyDate &&
      typeof applyWeekday !== "number" &&
      !limit &&
      orderBy === "createdat_desc";
    if (canCache) {
      await writeCache(CACHE_KEYS.trainingPlans, mapped);
    }
    return filtered;
  } catch (error) {
    if (isNetworkError(error) || isAuthError(error)) {
      const cached = await readCache<TrainingPlan[]>(CACHE_KEYS.trainingPlans);
      if (cached) {
        const classId = options.classId?.trim() || "";
        const status = options.status;
        const applyDate = options.applyDate?.trim() || "";
        const applyWeekday = options.applyWeekday;
        const orderBy = options.orderBy ?? "createdat_desc";
        const limit = options.limit;
        const byClass = classId ? cached.filter((plan) => plan.classId === classId) : cached;
        const byDate = applyDate ? byClass.filter((plan) => plan.applyDate === applyDate) : byClass;
        const byWeekday =
          typeof applyWeekday === "number" && Number.isFinite(applyWeekday)
            ? byDate.filter((plan) => (plan.applyDays ?? []).includes(Math.floor(applyWeekday)))
            : byDate;
        const byStatus = applyStatusFilter(byWeekday, status);
        const sorted =
          orderBy === "version_desc"
            ? [...byStatus].sort((a, b) => {
                const versionDiff = (b.version ?? 0) - (a.version ?? 0);
                if (versionDiff !== 0) return versionDiff;
                return getPlanTimestamp(b) - getPlanTimestamp(a);
              })
            : byStatus;
        if (typeof limit === "number" && limit > 0) {
          return sorted.slice(0, Math.floor(limit));
        }
        return sorted;
      }
    }
    throw error;
  }
}

export async function saveTrainingPlan(plan: TrainingPlan, options?: { organizationId?: string }) {
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  const versionedPayload = buildTrainingPlanVersionedPayload(plan, organizationId);
  try {
    await supabasePost("/training_plans", [versionedPayload]);
  } catch (error) {
    if (!isMissingVersioningColumnError(error)) throw error;
    logVersioningSchemaFallback("insert", error);
    await supabasePost("/training_plans", [buildTrainingPlanBasePayload(plan, organizationId)]);
  }
}

export async function updateTrainingPlan(plan: TrainingPlan, options?: { organizationId?: string }) {
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  const endpoint = organizationId
    ? "/training_plans?id=eq." +
        encodeURIComponent(plan.id) +
        "&organization_id=eq." +
        encodeURIComponent(organizationId)
    : "/training_plans?id=eq." + encodeURIComponent(plan.id);
  try {
    await supabasePatch(endpoint, buildTrainingPlanVersionedPayload(plan, organizationId));
  } catch (error) {
    if (!isMissingVersioningColumnError(error)) throw error;
    logVersioningSchemaFallback("update", error);
    await supabasePatch(endpoint, buildTrainingPlanBasePayload(plan, organizationId));
  }
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
  const plans = await getTrainingPlans({
    organizationId: options.organizationId ?? (await getActiveOrganizationId()),
    classId,
    status: "final",
    orderBy: "version_desc",
    limit: 1,
  });
  return plans[0] ?? pickLatestFinalTrainingPlan(plans);
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

// ---------------------------------------------------------------------------
// Override Events (pedagogical decision tracking for learning)
// ---------------------------------------------------------------------------

export async function saveOverrideEvent(overrideEvent: {
  classId: string;
  fromRuleId: string;
  toRuleId: string;
  reasonText?: string;
  reasonTags?: string[];
  organizationId?: string;
}) {
  const organizationId = overrideEvent.organizationId ?? (await getActiveOrganizationId());

  await supabasePost("/override_events", [
    {
      id: `override_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      organization_id: organizationId,
      class_id: overrideEvent.classId,
      from_rule_id: overrideEvent.fromRuleId,
      to_rule_id: overrideEvent.toRuleId,
      reason_text: overrideEvent.reasonText ?? null,
      reason_tags: overrideEvent.reasonTags ?? null,
      created_at: new Date().toISOString(),
    },
  ]);
}

export type OverrideStatRow = {
  from_rule_id: string;
  to_rule_id: string;
  count: number;
};

export async function getOverrideStats(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<OverrideStatRow[]> {
  const organizationId = options.organizationId ?? (await getActiveOrganizationId());

  try {
    const endpoint = `/override_events?select=from_rule_id,to_rule_id,count:count()&class_id=eq.${encodeURIComponent(
      classId
    )}&organization_id=eq.${encodeURIComponent(
      organizationId ?? ""
    )}&group=from_rule_id,to_rule_id&order=count.desc`;

    const rows = await supabaseGet<OverrideStatRow[]>(endpoint);
    return rows;
  } catch (error) {
    console.warn("[OverrideStats] Failed to fetch override stats", error);
    Sentry.addBreadcrumb({
      category: "override-stats",
      level: "warning",
      message: "Failed to fetch override statistics",
      data: { classId, error: String(error) },
    });
    return [];
  }
}

export type OverrideStatsByRule = Record<
  string,
  Record<string, number>
>; // { fromRuleId → { toRuleId → count } }

export async function getOverrideStatsByRule(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<OverrideStatsByRule> {
  const stats = await getOverrideStats(classId, options);

  const map: OverrideStatsByRule = {};

  for (const stat of stats) {
    if (!map[stat.from_rule_id]) {
      map[stat.from_rule_id] = {};
    }
    map[stat.from_rule_id][stat.to_rule_id] = stat.count;
  }

  return map;
}
