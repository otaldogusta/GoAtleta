import type { PlanningCycle } from "../core/models";
import { resolvePlanningCycleWindow } from "../core/planning-cycle-window";
import { db } from "./sqlite";

function mapRow(row: Record<string, unknown>): PlanningCycle {
  return {
    id: String(row.id ?? ""),
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

export async function getPlanningCycles(classId: string): Promise<PlanningCycle[]> {
  try {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM planning_cycles WHERE classId = ? ORDER BY year DESC",
      [classId]
    );
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

export async function getActivePlanningCycle(classId: string): Promise<PlanningCycle | null> {
  try {
    const row = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM planning_cycles WHERE classId = ? AND status = 'active' ORDER BY year DESC LIMIT 1",
      [classId]
    );
    return row ? mapRow(row) : null;
  } catch {
    return null;
  }
}

export async function upsertPlanningCycle(cycle: PlanningCycle): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO planning_cycles
       (id, classId, year, title, startDate, endDate, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cycle.id,
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

export async function archivePlanningCycle(cycleId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    "UPDATE planning_cycles SET status = 'archived', updatedAt = ? WHERE id = ?",
    [now, cycleId]
  );
}

/**
 * Returns the active cycle for the given class+year, creating one if it doesn't
 * exist yet. Any other active cycle for the same class is archived automatically.
 */
export async function ensureActiveCycleForYear(
  classId: string,
  year: number,
  classStartDate?: string | null
): Promise<PlanningCycle> {
  const now = new Date().toISOString();
  const window = resolvePlanningCycleWindow(classStartDate, year);

  const existing = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM planning_cycles WHERE classId = ? AND year = ? AND status = 'active' LIMIT 1",
    [classId, year]
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
    "UPDATE planning_cycles SET status = 'archived', updatedAt = ? WHERE classId = ? AND status = 'active'",
    [now, classId]
  );

  const cycle: PlanningCycle = {
    id: `pc_${classId}_${year}`,
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
