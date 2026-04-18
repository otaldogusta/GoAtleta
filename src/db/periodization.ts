// ---------------------------------------------------------------------------
// Class plans + competitive profiles + calendar exceptions domain module
// ---------------------------------------------------------------------------

import type {
    ClassCalendarException,
    ClassCalendarExceptionKind,
    ClassCompetitiveProfile,
    ClassPlan,
    CompetitivePlanningMode,
} from "../core/models";
import {
    CACHE_KEYS,
    getActiveOrganizationId,
    getScopedOrganizationId,
    isMissingRelation,
    isNetworkError,
    readCache,
    supabaseDelete,
    supabaseGet,
    supabasePatch,
    supabasePost,
    writeCache,
} from "./client";
import type {
    ClassCalendarExceptionRow,
    ClassCompetitiveProfileRow,
    ClassPlanRow,
} from "./row-types";

const isCycleIdColumnError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return normalized.includes("cycle_id") || normalized.includes("cycleid");
};

const isLegacyUniqueWeekConstraintError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("class_plans_unique_week") ||
    (normalized.includes("23505") && normalized.includes("duplicate key value"))
  );
};

const postClassPlansPayload = async (payload: Array<Record<string, unknown>>) => {
  try {
    await supabasePost("/class_plans", payload);
  } catch (error) {
    if (!isCycleIdColumnError(error)) throw error;
    await supabasePost(
      "/class_plans",
      payload.map(({ cycle_id: _ignoredCycleId, ...legacyPayload }) => legacyPayload)
    );
  }
};

const getExistingClassPlanByLegacyWeek = async (params: {
  classId: string;
  weekNumber: number;
  organizationId?: string | null;
}) => {
  const { classId, weekNumber, organizationId } = params;
  const path = organizationId
    ? `/class_plans?select=*&classid=eq.${encodeURIComponent(classId)}&weeknumber=eq.${weekNumber}&organization_id=eq.${encodeURIComponent(organizationId)}&order=updatedat.desc.nullslast,createdat.desc.nullslast&limit=1`
    : `/class_plans?select=*&classid=eq.${encodeURIComponent(classId)}&weeknumber=eq.${weekNumber}&order=updatedat.desc.nullslast,createdat.desc.nullslast&limit=1`;
  const rows = await supabaseGet<ClassPlanRow[]>(path);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at ?? row.createdat ?? new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

const mapClassCompetitiveProfileRow = (
  row: ClassCompetitiveProfileRow
): ClassCompetitiveProfile => ({
  classId: row.class_id,
  organizationId: row.organization_id,
  planningMode:
    row.planning_mode === "adulto-competitivo"
      ? ("adulto-competitivo" as CompetitivePlanningMode)
      : "adulto-competitivo",
  cycleStartDate: row.cycle_start_date ?? "",
  targetCompetition: row.target_competition ?? "",
  targetDate: row.target_date ?? "",
  tacticalSystem: row.tactical_system ?? "",
  currentPhase: row.current_phase ?? "",
  notes: row.notes ?? "",
  createdAt: row.created_at ?? new Date().toISOString(),
  updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
});

const mapClassCalendarExceptionRow = (
  row: ClassCalendarExceptionRow
): ClassCalendarException => ({
  id: row.id,
  classId: row.class_id,
  organizationId: row.organization_id,
  date: row.date,
  reason: row.reason ?? "",
  kind: row.kind === "no_training" ? ("no_training" as ClassCalendarExceptionKind) : "no_training",
  createdAt: row.created_at ?? new Date().toISOString(),
});

// ---------------------------------------------------------------------------
// Class plans
// ---------------------------------------------------------------------------

export async function getClassPlansByClass(
  classId: string,
  options: { organizationId?: string | null; cycleId?: string | null; cycleYear?: number | null } = {}
): Promise<ClassPlan[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    const cycleYear = typeof options.cycleYear === "number" ? options.cycleYear : null;
    const yearFilter = cycleYear
      ? "&startdate=gte." + encodeURIComponent(`${cycleYear}-01-01`) +
        "&startdate=lte." + encodeURIComponent(`${cycleYear}-12-31`)
      : "";
    const rows = await supabaseGet<ClassPlanRow[]>(
      organizationId
        ? `/class_plans?select=*&classid=eq.${encodeURIComponent(classId)}&organization_id=eq.${encodeURIComponent(organizationId)}${yearFilter}&order=weeknumber.asc`
        : `/class_plans?select=*&classid=eq.${encodeURIComponent(classId)}${yearFilter}&order=weeknumber.asc`
    );
    const mapped = rows.map((row) => ({
      source: (row.source === "MANUAL" ? "MANUAL" : "AUTO") as ClassPlan["source"],
      id: row.id,
      classId: row.classid,
      cycleId: row.cycle_id ?? "",
      startDate: row.startdate,
      weekNumber: row.weeknumber,
      phase: row.phase,
      theme: row.theme,
      technicalFocus: row.technical_focus ?? "",
      physicalFocus: row.physical_focus ?? "",
      constraints: row.constraints ?? row.ruleset ?? "",
      mvFormat: row.mv_format ?? "",
      warmupProfile: row.warmupprofile ?? "",
      jumpTarget: row.jump_target ?? "",
      rpeTarget: row.rpe_target ?? "",
      createdAt: row.created_at ?? row.createdat ?? new Date().toISOString(),
      updatedAt:
        row.updated_at ??
        row.updatedat ??
        row.created_at ??
        row.createdat ??
        new Date().toISOString(),
    }));
    const normalizedCycleId = (options.cycleId ?? "").trim();
    const filtered = normalizedCycleId
      ? mapped
          .filter((row) => {
            if ((row.cycleId ?? "").trim() === normalizedCycleId) return true;
            if (!cycleYear) return false;
            const year = Number((row.startDate ?? "").slice(0, 4));
            return Number.isFinite(year) && year === cycleYear;
          })
          .map((row) => {
            if ((row.cycleId ?? "").trim()) return row;
            if (!cycleYear) return row;
            const year = Number((row.startDate ?? "").slice(0, 4));
            if (!Number.isFinite(year) || year !== cycleYear) return row;
            return {
              ...row,
              cycleId: normalizedCycleId,
            };
          })
      : mapped;
    const cache = (await readCache<Record<string, ClassPlan[]>>(CACHE_KEYS.classPlans)) ?? {};
    cache[classId] = filtered;
    await writeCache(CACHE_KEYS.classPlans, cache);
    return filtered;
  } catch (error) {
    if (isMissingRelation(error, "class_plans")) return [];
    if (isNetworkError(error)) {
      const cache = await readCache<Record<string, ClassPlan[]>>(CACHE_KEYS.classPlans);
      if (cache && cache[classId]) return cache[classId];
    }
    throw error;
  }
}

export async function createClassPlan(plan: ClassPlan) {
  try {
    await saveClassPlans([plan]);
  } catch (error) {
    if (error instanceof Error && error.message.includes("23505")) {
      const existing = await getClassPlansByClass(plan.classId, {
        cycleId: plan.cycleId ?? null,
        cycleYear: Number(plan.startDate.slice(0, 4)) || null,
      });
      const match = existing.find((item) => item.weekNumber === plan.weekNumber);
      if (match) {
        await updateClassPlan({ ...plan, id: match.id, createdAt: match.createdAt });
        return;
      }
    }
    throw error;
  }
}

export async function updateClassPlan(
  plan: ClassPlan,
  options?: { organizationId?: string | null }
) {
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  const path = organizationId
    ? "/class_plans?id=eq." +
      encodeURIComponent(plan.id) +
      "&organization_id=eq." +
      encodeURIComponent(organizationId)
    : "/class_plans?id=eq." + encodeURIComponent(plan.id);
  const payload = {
    classid: plan.classId,
    cycle_id: plan.cycleId || null,
    startdate: plan.startDate,
    weeknumber: plan.weekNumber,
    phase: plan.phase,
    theme: plan.theme,
    technical_focus: plan.technicalFocus,
    physical_focus: plan.physicalFocus,
    constraints: plan.constraints,
    ruleset: plan.constraints,
    mv_format: plan.mvFormat,
    warmupprofile: plan.warmupProfile,
    source: plan.source,
    organization_id: organizationId ?? undefined,
    jump_target: plan.jumpTarget,
    rpe_target: plan.rpeTarget,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt ?? plan.createdAt,
  };
  try {
    await supabasePatch(path, payload);
  } catch (error) {
    if (!isCycleIdColumnError(error)) throw error;
    const { cycle_id: _ignoredCycleId, ...legacyPayload } = payload;
    await supabasePatch(path, legacyPayload);
  }
}

export async function saveClassPlans(plans: ClassPlan[], options?: { organizationId?: string }) {
  if (!plans.length) return;
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  const payload = plans.map((plan) => ({
    id: plan.id,
    classid: plan.classId,
    cycle_id: plan.cycleId || null,
    organization_id: organizationId ?? undefined,
    startdate: plan.startDate,
    weeknumber: plan.weekNumber,
    phase: plan.phase,
    theme: plan.theme,
    technical_focus: plan.technicalFocus,
    physical_focus: plan.physicalFocus,
    constraints: plan.constraints,
    ruleset: plan.constraints,
    mv_format: plan.mvFormat,
    warmupprofile: plan.warmupProfile,
    source: plan.source,
    jump_target: plan.jumpTarget,
    rpe_target: plan.rpeTarget,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt ?? plan.createdAt,
  }));
  try {
    await postClassPlansPayload(payload);
  } catch (error) {
    if (!isLegacyUniqueWeekConstraintError(error)) throw error;

    // Legacy backend fallback: class_plans_unique_week is scoped only by class+week.
    // Upsert each plan by week number to avoid batch failure until remote index migration is applied.
    for (const plan of plans) {
      const existing = await getExistingClassPlanByLegacyWeek({
        classId: plan.classId,
        weekNumber: plan.weekNumber,
        organizationId,
      });

      if (existing) {
        await updateClassPlan(
          { ...plan, id: existing.id, createdAt: existing.createdAt },
          { organizationId }
        );
        continue;
      }

      const singlePayload = payload.find((row) => row.id === plan.id);
      if (singlePayload) {
        await postClassPlansPayload([singlePayload]);
      }
    }
  }
}

export async function deleteClassPlansByClass(
  classId: string,
  options?: { organizationId?: string | null; cycleId?: string | null; cycleYear?: number | null }
) {
  const organizationId = options?.organizationId ?? (await getActiveOrganizationId());
  const cycleFilter = (options?.cycleId ?? "").trim();
  const cycleYear = typeof options?.cycleYear === "number" ? options.cycleYear : null;
  const yearPath = cycleYear
    ? "&startdate=gte." + encodeURIComponent(`${cycleYear}-01-01`) +
      "&startdate=lte." + encodeURIComponent(`${cycleYear}-12-31`)
    : "";
  const cyclePath = !yearPath && cycleFilter
    ? "&cycle_id=eq." + encodeURIComponent(cycleFilter)
    : "";
  const basePath =
    "/class_plans?classid=eq." +
    encodeURIComponent(classId) +
    cyclePath +
    yearPath +
    (organizationId ? "&organization_id=eq." + encodeURIComponent(organizationId) : "");
  try {
    await supabaseDelete(basePath);
  } catch (error) {
    if (!cycleFilter || !isCycleIdColumnError(error)) throw error;
    // Legacy fallback: backend without cycle_id column.
    await supabaseDelete(
      "/class_plans?classid=eq." +
        encodeURIComponent(classId) +
        yearPath +
        (organizationId ? "&organization_id=eq." + encodeURIComponent(organizationId) : "")
    );
  }
}

// ---------------------------------------------------------------------------
// Competitive profiles
// ---------------------------------------------------------------------------

export async function getClassCompetitiveProfile(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<ClassCompetitiveProfile | null> {
  try {
    const organizationId = await getScopedOrganizationId(
      options.organizationId,
      "getClassCompetitiveProfile"
    );
    if (!organizationId) return null;
    const rows = await supabaseGet<ClassCompetitiveProfileRow[]>(
      `/class_competitive_profiles?select=*&class_id=eq.${encodeURIComponent(
        classId
      )}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`
    );
    const first = rows[0] ? mapClassCompetitiveProfileRow(rows[0]) : null;
    const cache =
      (await readCache<Record<string, ClassCompetitiveProfile | null>>(
        CACHE_KEYS.classCompetitiveProfiles
      )) ?? {};
    cache[classId] = first;
    await writeCache(CACHE_KEYS.classCompetitiveProfiles, cache);
    return first;
  } catch (error) {
    if (isMissingRelation(error, "class_competitive_profiles")) return null;
    if (isNetworkError(error)) {
      const cache = await readCache<Record<string, ClassCompetitiveProfile | null>>(
        CACHE_KEYS.classCompetitiveProfiles
      );
      if (cache && classId in cache) return cache[classId] ?? null;
    }
    throw error;
  }
}

export async function saveClassCompetitiveProfile(
  profile: ClassCompetitiveProfile,
  options?: { organizationId?: string | null }
) {
  const organizationId = await getScopedOrganizationId(
    options?.organizationId ?? profile.organizationId,
    "saveClassCompetitiveProfile"
  );
  if (!organizationId) {
    throw new Error("Organizacao ativa nao encontrada.");
  }
  const nowIso = new Date().toISOString();
  await supabasePost(
    "/class_competitive_profiles",
    [
      {
        class_id: profile.classId,
        organization_id: organizationId,
        planning_mode: profile.planningMode,
        cycle_start_date: profile.cycleStartDate || null,
        target_competition: profile.targetCompetition.trim() || null,
        target_date: profile.targetDate || null,
        tactical_system: profile.tacticalSystem.trim() || null,
        current_phase: profile.currentPhase.trim() || null,
        notes: profile.notes.trim() || null,
        created_at: profile.createdAt || nowIso,
        updated_at: nowIso,
      },
    ],
    {
      Prefer: "resolution=merge-duplicates",
    }
  );
  const cache =
    (await readCache<Record<string, ClassCompetitiveProfile | null>>(
      CACHE_KEYS.classCompetitiveProfiles
    )) ?? {};
  cache[profile.classId] = {
    ...profile,
    organizationId,
    createdAt: profile.createdAt || nowIso,
    updatedAt: nowIso,
  };
  await writeCache(CACHE_KEYS.classCompetitiveProfiles, cache);
}

export async function deleteClassCompetitiveProfile(
  classId: string,
  options?: { organizationId?: string | null }
) {
  const organizationId = await getScopedOrganizationId(
    options?.organizationId,
    "deleteClassCompetitiveProfile"
  );
  await supabaseDelete(
    organizationId
      ? `/class_competitive_profiles?class_id=eq.${encodeURIComponent(
          classId
        )}&organization_id=eq.${encodeURIComponent(organizationId)}`
      : `/class_competitive_profiles?class_id=eq.${encodeURIComponent(classId)}`
  );
  const cache =
    (await readCache<Record<string, ClassCompetitiveProfile | null>>(
      CACHE_KEYS.classCompetitiveProfiles
    )) ?? {};
  delete cache[classId];
  await writeCache(CACHE_KEYS.classCompetitiveProfiles, cache);
}

// ---------------------------------------------------------------------------
// Calendar exceptions
// ---------------------------------------------------------------------------

export async function getClassCalendarExceptions(
  classId: string,
  options: { organizationId?: string | null } = {}
): Promise<ClassCalendarException[]> {
  try {
    const organizationId = await getScopedOrganizationId(
      options.organizationId,
      "getClassCalendarExceptions"
    );
    if (!organizationId) return [];
    const rows = await supabaseGet<ClassCalendarExceptionRow[]>(
      `/class_calendar_exceptions?select=*&class_id=eq.${encodeURIComponent(
        classId
      )}&organization_id=eq.${encodeURIComponent(organizationId)}&order=date.asc`
    );
    const mapped = rows.map(mapClassCalendarExceptionRow);
    const cache =
      (await readCache<Record<string, ClassCalendarException[]>>(
        CACHE_KEYS.classCalendarExceptions
      )) ?? {};
    cache[classId] = mapped;
    await writeCache(CACHE_KEYS.classCalendarExceptions, cache);
    return mapped;
  } catch (error) {
    if (isMissingRelation(error, "class_calendar_exceptions")) return [];
    if (isNetworkError(error)) {
      const cache = await readCache<Record<string, ClassCalendarException[]>>(
        CACHE_KEYS.classCalendarExceptions
      );
      if (cache && cache[classId]) return cache[classId];
    }
    throw error;
  }
}

export async function saveClassCalendarException(
  item: ClassCalendarException,
  options?: { organizationId?: string | null }
) {
  const organizationId = await getScopedOrganizationId(
    options?.organizationId ?? item.organizationId,
    "saveClassCalendarException"
  );
  if (!organizationId) {
    throw new Error("Organizacao ativa nao encontrada.");
  }
  await supabasePost(
    "/class_calendar_exceptions",
    [
      {
        id: item.id,
        class_id: item.classId,
        organization_id: organizationId,
        date: item.date,
        reason: item.reason.trim() || null,
        kind: item.kind,
        created_at: item.createdAt || new Date().toISOString(),
      },
    ],
    {
      Prefer: "resolution=merge-duplicates",
    }
  );
}

export async function deleteClassCalendarException(
  id: string,
  options?: { organizationId?: string | null }
) {
  const organizationId = await getScopedOrganizationId(
    options?.organizationId,
    "deleteClassCalendarException"
  );
  await supabaseDelete(
    organizationId
      ? `/class_calendar_exceptions?id=eq.${encodeURIComponent(
          id
        )}&organization_id=eq.${encodeURIComponent(organizationId)}`
      : `/class_calendar_exceptions?id=eq.${encodeURIComponent(id)}`
  );
}
