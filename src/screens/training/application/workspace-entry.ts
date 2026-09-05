import type { ClassGroup, TrainingPlan } from "../../../core/models";
import { createPlanningWorkspaceDraft, type PlanningWorkspaceDraftTemplate } from "./planning-library-bridge";
import type { TrainingPlanWorkspaceDraft } from "./training-plan-workspace-draft";

export function resolveWorkspaceDraftRestoration(
  draft: TrainingPlanWorkspaceDraft | null,
  classes: readonly Pick<ClassGroup, "id">[],
  catalogReady: boolean,
): "waiting" | "available" | "unavailable" {
  if (!draft || !catalogReady) return "waiting";
  return !draft.plan.classId || classes.some((item) => item.id === draft.plan.classId)
    ? "available" : "unavailable";
}

export function parseAssistantWorkspaceDraft(raw: string): PlanningWorkspaceDraftTemplate | null {
  if (!raw.trim()) return null;
  try {
    const payload = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
    const lines = (value: unknown) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
    if (!payload || typeof payload !== "object") return null;
    return {
      title: text(payload.title), tags: lines(payload.tags),
      warmup: lines(payload.warmup), main: lines(payload.main), cooldown: lines(payload.cooldown),
      warmupTime: text(payload.warmupTime), mainTime: text(payload.mainTime), cooldownTime: text(payload.cooldownTime),
    };
  } catch {
    return null;
  }
}

export function createAssistantWorkspacePlan(
  draft: PlanningWorkspaceDraftTemplate,
  classGroup: ClassGroup | null,
  lessonDate: string,
): TrainingPlan {
  return {
    ...createPlanningWorkspaceDraft(classGroup, draft),
    title: draft.title || "Planejamento assistido",
    applyDate: lessonDate,
  };
}

export function resolveWorkspaceEntryRequest(params: {
  openForm: boolean;
  assistantRaw: string;
  targetClassId: string;
  targetDate: string;
  pendingCreate: { classId: string; date: string } | null;
}) {
  if (params.openForm) {
    const template = parseAssistantWorkspaceDraft(params.assistantRaw);
    if (params.assistantRaw && !template) return null;
    return {
      key: `route:${params.targetClassId}:${params.targetDate}:${params.assistantRaw}`,
      classId: params.targetClassId, date: params.targetDate, template,
    };
  }
  if (!params.pendingCreate) return null;
  return {
    key: `pending:${params.pendingCreate.classId}:${params.pendingCreate.date}`,
    classId: params.pendingCreate.classId, date: params.pendingCreate.date, template: null,
  };
}
