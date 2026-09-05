import type { PlanningCycle } from "../core/models";
import { resolvePlanningCycleWindow } from "../core/planning-cycle-window";
import {
  getScopedOrganizationId,
  isMissingColumnInSchemaCache,
  isMissingRelation,
  isNetworkError,
  supabaseGet,
  supabasePatch,
  supabasePost,
} from "./client";
import { db } from "./sqlite";

function serializePolicy(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

function parsePolicy(value: string | undefined): Record<string, unknown> {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function mapRow(row: Record<string, unknown>): PlanningCycle {
  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? row.organizationId ?? ""),
    classId: String(row.classid ?? row.classId ?? ""),
    year: Number(row.year ?? 0),
    title: String(row.title ?? ""),
    startDate: String(row.start_date ?? row.startdate ?? row.startDate ?? ""),
    endDate: String(row.end_date ?? row.enddate ?? row.endDate ?? ""),
    status: row.status === "archived" ? "archived" : "active",
    periodizationPolicyJson: serializePolicy(
      row.periodization_policy_json ?? row.periodizationPolicyJson,
    ),
    policyVersion: Number(row.policy_version ?? row.policyVersion ?? 1),
    createdAt: String(row.created_at ?? row.createdat ?? row.createdAt ?? ""),
    updatedAt: String(row.updated_at ?? row.updatedat ?? row.updatedAt ?? ""),
  };
}

async function getLocalPlanningCycles(
  classId: string,
  organizationId: string,
): Promise<PlanningCycle[]> {
  try {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM planning_cycles WHERE classId = ? AND organizationId = ? ORDER BY year DESC",
      [classId, organizationId],
    );
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

async function upsertLocalPlanningCycle(cycle: PlanningCycle): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO planning_cycles
       (id, organizationId, classId, year, title, startDate, endDate, status,
        periodizationPolicyJson, policyVersion, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cycle.id,
      cycle.organizationId,
      cycle.classId,
      cycle.year,
      cycle.title,
      cycle.startDate,
      cycle.endDate,
      cycle.status,
      cycle.periodizationPolicyJson ?? "",
      cycle.policyVersion ?? 1,
      cycle.createdAt,
      cycle.updatedAt,
    ],
  );
}

const planningCyclePayload = (cycle: PlanningCycle) => ({
  id: cycle.id,
  organization_id: cycle.organizationId,
  classid: cycle.classId,
  year: cycle.year,
  title: cycle.title,
  start_date: cycle.startDate,
  end_date: cycle.endDate,
  status: cycle.status,
  periodization_policy_json: parsePolicy(cycle.periodizationPolicyJson),
  policy_version: cycle.policyVersion ?? 1,
  created_at: cycle.createdAt,
  updated_at: cycle.updatedAt,
});

const stripPendingPolicyColumns = (
  payload: ReturnType<typeof planningCyclePayload>,
) => {
  const {
    periodization_policy_json: _ignoredPolicy,
    policy_version: _ignoredVersion,
    ...compatiblePayload
  } = payload;
  return compatiblePayload;
};

const isPendingPolicyColumnError = (error: unknown) =>
  isMissingColumnInSchemaCache(error, "periodization_policy_json") ||
  isMissingColumnInSchemaCache(error, "policy_version");

export async function getPlanningCycles(
  classId: string,
  organizationId: string,
): Promise<PlanningCycle[]> {
  const scopedOrganizationId = await getScopedOrganizationId(
    organizationId,
    "getPlanningCycles",
  );
  if (!scopedOrganizationId) return [];

  const localCycles = await getLocalPlanningCycles(classId, scopedOrganizationId);
  try {
    const rows = await supabaseGet<Record<string, unknown>[]>(
      `/planning_cycles?select=*&classid=eq.${encodeURIComponent(
        classId,
      )}&organization_id=eq.${encodeURIComponent(
        scopedOrganizationId,
      )}&order=year.desc`,
    );
    const localById = new Map(localCycles.map((cycle) => [cycle.id, cycle]));
    const cycles = rows.map((row) => {
      const remote = mapRow(row);
      const local = localById.get(remote.id);
      return {
        ...remote,
        periodizationPolicyJson:
          remote.periodizationPolicyJson || local?.periodizationPolicyJson || "",
        policyVersion: remote.periodizationPolicyJson
          ? remote.policyVersion
          : local?.policyVersion ?? remote.policyVersion ?? 1,
      };
    });
    await Promise.all(
      cycles.map(async (cycle) => {
        try {
          await upsertLocalPlanningCycle(cycle);
        } catch {
          // Supabase remains authoritative when the local cache is unavailable.
        }
      }),
    );
    return cycles;
  } catch (error) {
    if (isNetworkError(error) || isMissingRelation(error, "planning_cycles")) {
      return localCycles;
    }
    throw error;
  }
}

export async function getActivePlanningCycle(
  classId: string,
  organizationId: string,
): Promise<PlanningCycle | null> {
  const cycles = await getPlanningCycles(classId, organizationId);
  return cycles.find((cycle) => cycle.status === "active") ?? null;
}

/**
 * Restores the first active cycle for a configured class without reopening a
 * cycle that the coach intentionally archived in the same year.
 */
export async function getOrCreateInitialActivePlanningCycle(
  classId: string,
  organizationId: string,
  year: number,
  classStartDate?: string | null,
): Promise<{ cycles: PlanningCycle[]; activeCycle: PlanningCycle | null }> {
  const cycles = await getPlanningCycles(classId, organizationId);
  const activeCycle = cycles.find((cycle) => cycle.status === "active") ?? null;

  if (activeCycle) return { cycles, activeCycle };

  const archivedCurrentCycle = cycles.some(
    (cycle) => cycle.year === year && cycle.status === "archived",
  );
  if (archivedCurrentCycle) return { cycles, activeCycle: null };

  const ensuredCycle = await ensureActiveCycleForYear(
    classId,
    organizationId,
    year,
    classStartDate,
  );
  const refreshedCycles = await getPlanningCycles(classId, organizationId);

  return {
    cycles: refreshedCycles.length ? refreshedCycles : [ensuredCycle],
    activeCycle: ensuredCycle,
  };
}

export async function upsertPlanningCycle(cycle: PlanningCycle): Promise<void> {
  const scopedOrganizationId = await getScopedOrganizationId(
    cycle.organizationId,
    "upsertPlanningCycle",
  );
  if (!scopedOrganizationId) {
    throw new Error("Organização ativa não encontrada para salvar o ciclo.");
  }
  const scopedCycle = { ...cycle, organizationId: scopedOrganizationId };
  const payload = planningCyclePayload(scopedCycle);
  try {
    await supabasePost("/planning_cycles", [payload], {
      Prefer: "resolution=merge-duplicates",
    });
  } catch (error) {
    if (!isPendingPolicyColumnError(error)) throw error;
    await supabasePost("/planning_cycles", [stripPendingPolicyColumns(payload)], {
      Prefer: "resolution=merge-duplicates",
    });
  }
  await upsertLocalPlanningCycle(scopedCycle);
}

export async function archivePlanningCycle(
  cycleId: string,
  organizationId: string,
): Promise<void> {
  const scopedOrganizationId = await getScopedOrganizationId(
    organizationId,
    "archivePlanningCycle",
  );
  if (!scopedOrganizationId) {
    throw new Error("Organização ativa não encontrada para encerrar o ciclo.");
  }
  const now = new Date().toISOString();
  const updated = await supabasePatch<{ id: string }[]>(
    `/planning_cycles?id=eq.${encodeURIComponent(
      cycleId,
    )}&organization_id=eq.${encodeURIComponent(scopedOrganizationId)}&select=id`,
    { status: "archived", updated_at: now },
    { Prefer: "return=representation" },
  );
  if (!updated.some((row) => row.id === cycleId)) {
    throw new Error(
      "O ciclo ativo não foi encontrado neste workspace. Atualize a tela e tente novamente.",
    );
  }
  await db.runAsync(
    "UPDATE planning_cycles SET status = 'archived', updatedAt = ? WHERE id = ? AND organizationId = ?",
    [now, cycleId, scopedOrganizationId],
  );
}

/**
 * Returns the active cycle for the given class+year, creating one if it doesn't
 * exist yet. Any other active cycle for the same class is archived automatically.
 */
export async function ensureActiveCycleForYear(
  classId: string,
  organizationId: string,
  year: number,
  classStartDate?: string | null,
): Promise<PlanningCycle> {
  const now = new Date().toISOString();
  const window = resolvePlanningCycleWindow(classStartDate, year);
  const cycles = await getPlanningCycles(classId, organizationId);
  const existing = cycles.find(
    (cycle) => cycle.year === year && cycle.status === "active",
  );
  if (existing) {
    const shouldNormalizeWindow =
      existing.startDate !== window.startDate ||
      existing.endDate !== window.endDate ||
      (existing.title ?? "") !== window.label;

    if (!shouldNormalizeWindow) return existing;

    const normalizedCycle: PlanningCycle = {
      ...existing,
      title: window.label,
      startDate: window.startDate,
      endDate: window.endDate,
      updatedAt: now,
    };
    await upsertPlanningCycle(normalizedCycle);
    return normalizedCycle;
  }

  if (cycles.some((cycle) => cycle.year === year && cycle.status === "archived")) {
    throw new Error(
      `O ciclo de ${year} foi encerrado. Escolha uma data de início em outro ano para criar o próximo ciclo.`,
    );
  }

  const scopedOrganizationId = await getScopedOrganizationId(
    organizationId,
    "ensureActiveCycleForYear",
  );
  if (!scopedOrganizationId) {
    throw new Error("Organização ativa não encontrada para criar o ciclo.");
  }

  await supabasePatch(
    `/planning_cycles?classid=eq.${encodeURIComponent(
      classId,
    )}&organization_id=eq.${encodeURIComponent(
      scopedOrganizationId,
    )}&status=eq.active`,
    { status: "archived", updated_at: now },
  );
  await db.runAsync(
    "UPDATE planning_cycles SET status = 'archived', updatedAt = ? WHERE classId = ? AND organizationId = ? AND status = 'active'",
    [now, classId, scopedOrganizationId],
  );

  const cycle: PlanningCycle = {
    id: `pc_${classId}_${year}`,
    organizationId: scopedOrganizationId,
    classId,
    year,
    title: window.label,
    startDate: window.startDate,
    endDate: window.endDate,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await upsertPlanningCycle(cycle);
  return cycle;
}
