import type { PlanningCycle } from "../core/models";
import { resolvePlanningCycleWindow } from "../core/planning-cycle-window";
import { db } from "./sqlite";

function mapRow(row: Record<string, unknown>): PlanningCycle {
  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organizationId ?? ""),
    classId: String(row.classId ?? ""),
    year: Number(row.year ?? 0),
    title: String(row.title ?? ""),
    startDate: String(row.startDate ?? ""),
    endDate: String(row.endDate ?? ""),
    status: row.status === "archived" ? "archived" : "active",
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
  };
}

export async function getPlanningCycles(
  classId: string,
  organizationId: string
): Promise<PlanningCycle[]> {
  try {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM planning_cycles WHERE classId = ? AND organizationId = ? ORDER BY year DESC",
      [classId, organizationId]
    );
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

export async function getActivePlanningCycle(
  classId: string,
  organizationId: string
): Promise<PlanningCycle | null> {
  try {
    const row = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM planning_cycles WHERE classId = ? AND organizationId = ? AND status = 'active' ORDER BY year DESC LIMIT 1",
      [classId, organizationId]
    );
    return row ? mapRow(row) : null;
  } catch {
    return null;
  }
}

export async function upsertPlanningCycle(cycle: PlanningCycle): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO planning_cycles
       (id, organizationId, classId, year, title, startDate, endDate, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cycle.id,
      cycle.organizationId,
      cycle.classId,
      cycle.year,
      cycle.title,
      cycle.startDate,
      cycle.endDate,
      cycle.status,
      cycle.createdAt,
      cycle.updatedAt,
    ]
  );
}

export async function archivePlanningCycle(
  cycleId: string,
  organizationId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    "UPDATE planning_cycles SET status = 'archived', updatedAt = ? WHERE id = ? AND organizationId = ?",
    [now, cycleId, organizationId]
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
  classStartDate?: string | null
): Promise<PlanningCycle> {
  const now = new Date().toISOString();
  const window = resolvePlanningCycleWindow(classStartDate, year);

  const existing = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM planning_cycles WHERE classId = ? AND organizationId = ? AND year = ? AND status = 'active' LIMIT 1",
    [classId, organizationId, year]
  );
  if (existing) {
    const existingCycle = mapRow(existing);
    const shouldNormalizeWindow =
      existingCycle.startDate !== window.startDate ||
      existingCycle.endDate !== window.endDate ||
      (existingCycle.title ?? "") !== window.label;

    if (!shouldNormalizeWindow) return existingCycle;

    const normalizedCycle: PlanningCycle = {
      ...existingCycle,
      title: window.label,
      startDate: window.startDate,
      endDate: window.endDate,
      updatedAt: now,
    };
    await upsertPlanningCycle(normalizedCycle);
    return normalizedCycle;
  }

  // Archive any other active cycles for this class (from prior years)
  await db.runAsync(
    "UPDATE planning_cycles SET status = 'archived', updatedAt = ? WHERE classId = ? AND organizationId = ? AND status = 'active'",
    [now, classId, organizationId]
  );

  const cycle: PlanningCycle = {
    id: `pc_${classId}_${year}`,
    organizationId,
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
