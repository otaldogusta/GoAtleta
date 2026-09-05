import type { ClassPlan } from "../../../core/models";
import { createClassPlan, markDailyLessonPlansOutOfSyncByWeek, updateClassPlan } from "../../../db/seed";
import { logAction } from "../../../observability/breadcrumbs";
import { measure } from "../../../observability/perf";
import { hasWeekPlanChanges } from "./edit-week-plan";

export type SaveWeekPlanCommand = {
  scope: { classId: string; cycleId: string };
  existing: ClassPlan | null;
  plan: ClassPlan;
};

type SaveWeekPlanOperations = {
  create: (plan: ClassPlan) => Promise<unknown>;
  update: (plan: ClassPlan) => Promise<unknown>;
  markDailyPlans: (weekPlanId: string) => Promise<unknown>;
};

const defaultOperations: SaveWeekPlanOperations = {
  create: (plan) => measure("createClassPlan", () => createClassPlan(plan)),
  update: (plan) => measure("updateClassPlan", () => updateClassPlan(plan)),
  markDailyPlans: markDailyLessonPlansOutOfSyncByWeek,
};

export type SaveWeekPlanResult = {
  status: "saved" | "unchanged";
  plan: ClassPlan;
  dailySyncFailed: boolean;
};

/** Persists one week without owning editor setters, modal state, or list state. */
export async function saveWeekPlan(
  command: SaveWeekPlanCommand,
  operations: SaveWeekPlanOperations = defaultOperations,
): Promise<SaveWeekPlanResult> {
  const { scope, existing, plan } = command;
  if (!scope.classId || !scope.cycleId) {
    throw new Error("Selecione uma turma com ciclo ativo antes de salvar.");
  }
  if (plan.classId !== scope.classId || plan.cycleId !== scope.cycleId ||
      (existing && (existing.id !== plan.id || existing.weekNumber !== plan.weekNumber || existing.classId !== scope.classId ||
        (existing.cycleId && existing.cycleId !== scope.cycleId)))) {
    throw new Error("A turma ou o ciclo mudou. Reabra a semana antes de salvar.");
  }
  if (!hasWeekPlanChanges(existing, plan)) {
    return { status: "unchanged", plan: existing!, dailySyncFailed: false };
  }

  await (existing ? operations.update(plan) : operations.create(plan));
  let dailySyncFailed = false;
  try {
    await operations.markDailyPlans(plan.id);
  } catch {
    dailySyncFailed = true;
  }
  logAction("Salvar periodizacao", {
    classId: scope.classId,
    weekNumber: plan.weekNumber,
    source: plan.source,
  });
  return { status: "saved", plan, dailySyncFailed };
}
