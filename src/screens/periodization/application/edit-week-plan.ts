import type { ClassPlan } from "../../../core/models";

export type WeekPlanEdits = Pick<
  ClassPlan,
  | "phase" | "theme" | "technicalFocus" | "physicalFocus" | "constraints"
  | "mvFormat" | "warmupProfile" | "jumpTarget" | "rpeTarget"
> & { pedagogicalRule: string };

const editedFields = [
  "phase", "theme", "pedagogicalRule", "technicalFocus", "physicalFocus",
  "constraints", "mvFormat", "warmupProfile", "jumpTarget", "rpeTarget",
] as const;

export function hasWeekPlanChanges(existing: ClassPlan | null, candidate: ClassPlan) {
  return !existing || existing.cycleId !== candidate.cycleId || hasContentChanges(existing, candidate);
}

function hasContentChanges(existing: ClassPlan | null, candidate: ClassPlan) {
  return !existing || editedFields.some((field) => (existing[field] ?? "") !== (candidate[field] ?? ""));
}

/** The editor preview and persisted week use the same fallback and identity rules. */
export function buildEditedWeekPlan(input: {
  basePlan: ClassPlan;
  existing: ClassPlan | null;
  cycleId: string;
  edits: WeekPlanEdits;
  now?: string;
}): ClassPlan {
  const { basePlan, existing, cycleId, edits } = input;
  const now = input.now ?? new Date().toISOString();
  const plan: ClassPlan = {
    ...basePlan,
    ...existing,
    id: existing?.id ?? `cp_${basePlan.classId}_${Date.parse(now)}_${basePlan.weekNumber}`,
    classId: basePlan.classId,
    cycleId,
    startDate: basePlan.startDate,
    weekNumber: basePlan.weekNumber,
    phase: edits.phase.trim() || basePlan.phase,
    theme: edits.theme.trim() || basePlan.theme,
    pedagogicalRule: edits.pedagogicalRule.trim(),
    technicalFocus: edits.technicalFocus.trim() || edits.theme.trim() || basePlan.technicalFocus,
    physicalFocus: edits.physicalFocus.trim() || basePlan.physicalFocus,
    constraints: edits.constraints.trim(),
    mvFormat: edits.mvFormat.trim() || basePlan.mvFormat,
    warmupProfile: edits.warmupProfile.trim() || basePlan.warmupProfile,
    jumpTarget: edits.jumpTarget.trim() || basePlan.jumpTarget,
    rpeTarget: edits.rpeTarget.trim() || basePlan.rpeTarget,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  plan.source = hasContentChanges(existing, plan) ? "MANUAL" : existing!.source;
  return plan;
}
