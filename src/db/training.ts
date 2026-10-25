// ---------------------------------------------------------------------------
// Training plans + templates + exercises domain module
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/react-native";
import { assertSessionIdentity, getSessionIdentity, SessionIdentityChangedError } from "../auth/session";
import type { Exercise, TrainingPlan } from "../core/models";
import {
  CACHE_KEYS,
  getActiveOrganizationId,
  getReadCacheGeneration,
  isNetworkError,
  readCache,
  supabaseDelete,
  supabaseGet,
  supabasePatch,
  supabasePost,
  writeCache,
} from "./client";
import type { ExerciseRow, TrainingPlanRow } from "./row-types";

export const mapTrainingPlanRow = (row: TrainingPlanRow): TrainingPlan => ({
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
  pedagogy: plan.pedagogy ?? null,
});

export const buildTrainingPlanVersionedPayload = (
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
  classIds?: string[];
  status?: "generated" | "final";
  applyDate?: string;
  applyWeekday?: number;
  orderBy?: TrainingPlansOrderBy;
  limit?: number;
  signal?: AbortSignal;
};

const buildTrainingPlansEndpoint = (
  organizationId: string | null,
  options: {
    classId: string;
    classIds?: string[];
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
  } else if (options.classIds) {
    query.push(`classid=in.(${options.classIds.map(id => encodeURIComponent(JSON.stringify(id))).join(",")})`);
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
    query.push("order=version.desc,createdat.desc,id.desc");
  } else {
    query.push("order=createdat.desc,id.desc");
  }
  if (typeof options.limit === "number" && options.limit > 0) {
    query.push(`limit=${Math.floor(options.limit)}`);
  }
  return `/training_plans?${query.join("&")}`;
};

const captureTrainingRead = async (requestedOrganizationId?: string | null, signal?: AbortSignal) => {
  const identity = getSessionIdentity();
  const generation = getReadCacheGeneration();
  const initialActiveOrganizationId = await getActiveOrganizationId();
  const organizationId = requestedOrganizationId ?? initialActiveOrganizationId;
  const assertContext = async () => {
    if (signal?.aborted) throw new Error("Leitura de planejamentos cancelada.");
    assertSessionIdentity(identity);
    if (!identity.userId || generation !== getReadCacheGeneration()) throw new SessionIdentityChangedError();
    const currentOrganizationId = await getActiveOrganizationId();
    assertSessionIdentity(identity);
    if (generation !== getReadCacheGeneration() || currentOrganizationId !== initialActiveOrganizationId) throw new SessionIdentityChangedError();
  };
  await assertContext();
  return { organizationId, identity, assertContext };
};

const readTrainingPlanPages = async <Row extends { id: string; createdat: string }>(
  endpoint: string,
  context: Awaited<ReturnType<typeof captureTrainingRead>>,
  limit?: number,
  orderBy: TrainingPlansOrderBy = "createdat_desc",
): Promise<Row[]> => {
  const rows: Row[] = [];
  const ids = new Set<string>();
  const maximum = typeof limit === "number" && limit > 0 ? Math.floor(limit) : Infinity;
  let cursor: Row | undefined;
  let readOlderBucket = false;
  for (let page = 0; page < 1000; page += 1) {
    await context.assertContext();
    const size = Math.min(500, maximum - rows.length);
    // Drain ties using both index keys, then move to older timestamps only
    // after an empty response. A short page can still be a backend row cap.
    const pagination = orderBy === "version_desc" ? `&offset=${rows.length}` : cursor
      ? readOlderBucket ? `&createdat=lt.${encodeURIComponent(cursor.createdat)}`
        : `&createdat=eq.${encodeURIComponent(cursor.createdat)}&id=lt.${encodeURIComponent(cursor.id)}`
      : "";
    const batch = await supabaseGet<Row[]>(`${endpoint}&limit=${size}${pagination}`, context.identity);
    await context.assertContext();
    if (!batch.length) {
      if (orderBy === "createdat_desc" && cursor && !readOlderBucket) {
        readOlderBucket = true;
        continue;
      }
      return rows;
    }
    for (const row of batch) {
      if (!row.id || !row.createdat || !Number.isFinite(Date.parse(row.createdat))) {
        throw new Error("A paginação de planejamentos retornou registros inválidos.");
      }
      if (ids.has(row.id)) throw new Error("A paginação de planejamentos retornou registros repetidos.");
      ids.add(row.id);
      rows.push(row);
    }
    cursor = batch[batch.length - 1];
    readOlderBucket = false;
    if (rows.length >= maximum) return rows.slice(0, maximum);
  }
  throw new Error("O volume de planejamentos excedeu o limite seguro de leitura.");
};

export type CalendarTrainingPlanApplication = Pick<TrainingPlan, "id" | "classId" | "applyDate" | "applyDays" | "createdAt">;
export type TrainingPlanSummary = Pick<TrainingPlan, "id" | "classId" | "title" | "tags" | "applyDate" | "applyDays" | "createdAt" | "version" | "status">;

export async function getTrainingPlanSummaries(options: { organizationId: string; classIds?: string[]; signal?: AbortSignal }): Promise<TrainingPlanSummary[]> {
  if (!options.organizationId.trim()) throw new Error("Organização não informada.");
  const context = await captureTrainingRead(options.organizationId, options.signal);
  const classIds = options.classIds ? Array.from(new Set(options.classIds.map(id => id.trim()).filter(Boolean))).sort() : undefined;
  if (classIds && classIds.length === 0) return [];
  const classFilter = classIds ? `&classid=in.(${classIds.map(id => encodeURIComponent(JSON.stringify(id))).join(",")})` : "";
  const cacheKey = `${CACHE_KEYS.trainingPlans}_${options.organizationId}_summaries_v1${classIds ? `_classes_${encodeURIComponent(JSON.stringify(classIds))}` : ""}`;
  try {
    type SummaryRow = Pick<TrainingPlanRow, "id" | "classid" | "title" | "tags" | "applydate" | "applydays" | "createdat" | "version" | "status">;
    const endpoint = `/training_plans?select=id,classid,title,tags,applydate,applydays,createdat,version,status&organization_id=eq.${encodeURIComponent(options.organizationId)}${classFilter}&order=createdat.desc,id.desc`;
    let rows: SummaryRow[];
    try {
      rows = await readTrainingPlanPages<SummaryRow>(endpoint, context);
    } catch (error) {
      if (!isMissingVersioningReadError(error)) throw error;
      rows = await readTrainingPlanPages<SummaryRow>(endpoint.replace(",version,status", ""), context);
    }
    const summaries = rows.map(row => ({ id: row.id, classId: row.classid, title: row.title, tags: row.tags ?? [], applyDate: row.applydate ?? "", applyDays: row.applydays ?? [], createdAt: row.createdat, version: row.version ?? undefined, status: row.status ?? undefined }));
    await writeCache(cacheKey, summaries);
    await context.assertContext();
    return summaries;
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await context.assertContext();
    const cached = await readCache<TrainingPlanSummary[]>(cacheKey);
    await context.assertContext();
    if (cached) return cached;
    throw error;
  }
}

export async function getTrainingPlanById(id: string, options: { organizationId: string; signal?: AbortSignal }): Promise<TrainingPlan | null> {
  if (!id.trim() || !options.organizationId.trim()) throw new Error("Planejamento ou organização não informado.");
  const context = await captureTrainingRead(options.organizationId, options.signal);
  const cacheKey = `${CACHE_KEYS.trainingPlans}_${options.organizationId}_detail_v1_${encodeURIComponent(id)}`;
  try {
    const rows = await supabaseGet<TrainingPlanRow[]>(`/training_plans?select=*&id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(options.organizationId)}&limit=1`, context.identity);
    await context.assertContext();
    const plan = rows[0] ? mapTrainingPlanRow(rows[0]) : null;
    await writeCache(cacheKey, plan);
    await context.assertContext();
    return plan;
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await context.assertContext();
    const cached = await readCache<TrainingPlan>(cacheKey);
    await context.assertContext();
    if (cached) return cached;
    throw error;
  }
}

// Calendar markers do not need lesson bodies, pedagogy or all historical dates.
// Legacy plans with BOTH a date and recurring weekdays still participate weekly.
export async function getCalendarTrainingPlanApplications(options: {
  organizationId: string;
  startDate: string;
  endDate: string;
  signal?: AbortSignal;
}): Promise<CalendarTrainingPlanApplication[]> {
  if (!options.organizationId.trim()) throw new Error("Organização não informada.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(options.endDate) || options.startDate > options.endDate) {
    throw new Error("Intervalo do calendário inválido.");
  }
  const context = await captureTrainingRead(options.organizationId, options.signal);
  const cacheKey = `${CACHE_KEYS.trainingPlans}_${options.organizationId}_calendar_v1_${options.startDate}_${options.endDate}`;
  try {
    const filter = `or=(and(applydate.gte.${options.startDate},applydate.lte.${options.endDate}),applydays.not.eq.{})`;
    const rows = await readTrainingPlanPages<Pick<TrainingPlanRow, "id" | "classid" | "applydate" | "applydays" | "createdat">>(
      `/training_plans?select=id,classid,applydate,applydays,createdat&organization_id=eq.${encodeURIComponent(options.organizationId)}&${encodeURI(filter)}&order=createdat.desc,id.desc`,
      context,
    );
    const applications = rows.map(row => ({ id: row.id, classId: row.classid, applyDate: row.applydate ?? "", applyDays: row.applydays ?? [], createdAt: row.createdat }));
    await writeCache(cacheKey, applications);
    await context.assertContext();
    return applications;
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    await context.assertContext();
    const cached = await readCache<CalendarTrainingPlanApplication[]>(cacheKey);
    await context.assertContext();
    if (cached) return cached;
    throw error;
  }
}

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

  const context = await captureTrainingRead(options.organizationId, options.signal);
  const { organizationId } = context;
  if (!organizationId) return [];
  const classIds = options.classIds ? Array.from(new Set(options.classIds.map(id => id.trim()).filter(Boolean))).sort() : undefined;
  const cacheKey = `${CACHE_KEYS.trainingPlans}_${organizationId ?? "none"}${classIds ? `_query_v1_${encodeURIComponent(JSON.stringify({ classIds, classId: options.classId, status: options.status, applyDate: options.applyDate, applyWeekday: options.applyWeekday, orderBy: options.orderBy, limit: options.limit }))}` : ""}`;
  try {
    const classId = options.classId?.trim() || "";
    if (classIds && classIds.length === 0) return [];
    const orderBy = options.orderBy ?? "createdat_desc";
    const status = options.status;
    const applyDate = options.applyDate?.trim() || undefined;
    const applyWeekday = options.applyWeekday;
    const limit = options.limit;
    const endpoint = buildTrainingPlansEndpoint(organizationId, {
      classId,
      classIds,
      status,
      applyDate,
      applyWeekday,
      orderBy,
    });
    let rows: TrainingPlanRow[];
    try {
      rows = await readTrainingPlanPages<TrainingPlanRow>(endpoint, context, limit, orderBy);
    } catch (error) {
      if (!isMissingVersioningReadError(error)) throw error;
      const fallbackEndpoint = buildTrainingPlansEndpoint(organizationId, {
        classId,
        classIds,
        applyDate,
        applyWeekday,
        orderBy: "createdat_desc",
      });
      rows = await readTrainingPlanPages<TrainingPlanRow>(fallbackEndpoint, context, limit);
    }
    const mapped = rows.map(mapTrainingPlanRow);
    const filtered = applyStatusFilter(mapped, status);
    const canCache = Boolean(classIds) || (
      !classId &&
      !status &&
      !applyDate &&
      typeof applyWeekday !== "number" &&
      !limit &&
      orderBy === "createdat_desc");
    if (canCache) {
      await writeCache(cacheKey, classIds ? filtered : mapped);
      await context.assertContext();
    }
    return filtered;
  } catch (error) {
    if (isNetworkError(error)) {
      await context.assertContext();
      const cached = await readCache<TrainingPlan[]>(cacheKey);
      await context.assertContext();
      if (cached) {
        const classId = options.classId?.trim() || "";
        const status = options.status;
        const applyDate = options.applyDate?.trim() || "";
        const applyWeekday = options.applyWeekday;
        const orderBy = options.orderBy ?? "createdat_desc";
        const limit = options.limit;
        const byClass = classId ? cached.filter((plan) => plan.classId === classId)
          : classIds ? cached.filter((plan) => classIds.includes(plan.classId)) : cached;
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

export async function saveTrainingPlans(
  plans: TrainingPlan[],
  options?: { organizationId?: string }
) {
  if (!plans.length) return;
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  try {
    await supabasePost(
      "/training_plans",
      plans.map((plan) => buildTrainingPlanVersionedPayload(plan, organizationId))
    );
  } catch (error) {
    if (!isMissingVersioningColumnError(error)) throw error;
    logVersioningSchemaFallback("insert", error);
    await supabasePost(
      "/training_plans",
      plans.map((plan) => buildTrainingPlanBasePayload(plan, organizationId))
    );
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
