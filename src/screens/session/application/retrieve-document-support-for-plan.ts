import type {
  ClassGroup,
  ClassPlan,
  DailyLessonPlan,
} from "../../../core/models";
import {
  retrieveDocumentPlanningSupport,
  type DocumentPlanningSupport,
} from "../../../db/document-context";

const uniqueStrings = (values: (string | null | undefined)[]) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const joinContext = (
  values: (string | null | undefined)[],
  maxLength: number
) => uniqueStrings(values).join(" · ").slice(0, maxLength);

export async function retrieveDocumentSupportForPlan(params: {
  classGroup: ClassGroup;
  sessionDate: string;
  classPlan?: ClassPlan | null;
  dailyLessonPlan?: DailyLessonPlan | null;
}): Promise<DocumentPlanningSupport> {
  const objective = joinContext(
    [
      params.dailyLessonPlan?.title,
      params.classPlan?.specificObjective,
      params.classPlan?.generalObjective,
      params.classPlan?.theme,
      params.classGroup.goal,
    ],
    500
  );
  const classNeeds = uniqueStrings([
    params.classPlan?.constraints,
    params.classPlan?.weekNotes,
    params.dailyLessonPlan?.observations,
  ]);

  return retrieveDocumentPlanningSupport({
    organizationId: params.classGroup.organizationId,
    classId: params.classGroup.id,
    context: {
      modality: params.classGroup.modality,
      ageBand: params.classGroup.ageBand,
      objective,
      skill: params.classPlan?.technicalFocus || params.classGroup.goal,
      pedagogicalApproach: params.classPlan?.pedagogicalRule,
      situationProblem: params.dailyLessonPlan?.observations,
      classNeeds,
      sessionDate: params.sessionDate,
    },
    limit: 8,
  });
}
