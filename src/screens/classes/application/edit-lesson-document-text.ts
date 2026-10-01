import type { TrainingPlan } from "../../../core/models";
import { isLessonDocumentTextKey } from "../../../pdf/lesson-document-text";

export function editLessonDocumentText(plan: TrainingPlan, key: string, text: string): TrainingPlan {
  if (!isLessonDocumentTextKey(key)) return plan;
  return {
    ...plan,
    pedagogy: {
      ...plan.pedagogy,
      lessonDocumentText: { ...plan.pedagogy?.lessonDocumentText, [key]: text.slice(0, 10000) },
    },
  };
}
