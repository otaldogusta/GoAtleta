import { getTrainingPlans, saveTrainingPlan } from "../../../db/seed";
import type { TrainingPlan } from "../../../core/models";
import { resolveTrainingPlanForDate, trainingPlanWeekday } from "../../../core/resolve-training-plan-for-date";
import type { LessonDraft } from "./lesson-draft";
import { parseLessonDraft } from "./lesson-draft";

export async function applyLessonDraft(params: {
  draft: LessonDraft; id: string; classId: string; organizationId: string;
  date: string; expectedPlanId: string | null; isCurrent: () => boolean;
}): Promise<TrainingPlan> {
  if (!params.organizationId || !params.classId || !parseLessonDraft(params.draft) || trainingPlanWeekday(params.date) === null) {
    throw new Error("Revise a turma, a data e o rascunho.");
  }
  const plans = await getTrainingPlans({ organizationId: params.organizationId, classId: params.classId, status: "final", orderBy: "version_desc" });
  if (!params.isCurrent()) throw new Error("O contexto da aula mudou. Abra a conversa novamente.");
  const alreadySaved = plans.find(plan => plan.id === params.id);
  if (alreadySaved) return alreadySaved;
  const current = resolveTrainingPlanForDate(plans, params.classId, params.date);
  if ((current?.id ?? null) !== params.expectedPlanId) throw new Error("O plano mudou enquanto você conversava. Recarregue a aula e revise novamente.");
  const now = new Date().toISOString();
  const next: TrainingPlan = {
    ...params.draft, id: params.id, classId: params.classId, applyDate: params.date, applyDays: [],
    status: "final", origin: "assistant", version: Math.max(0, ...plans.map(plan => plan.version ?? 0)) + 1,
    createdAt: now, finalizedAt: now, previousVersionId: current?.id, parentPlanId: current?.parentPlanId ?? current?.id,
  };
  await saveTrainingPlan(next, { organizationId: params.organizationId });
  return next;
}
