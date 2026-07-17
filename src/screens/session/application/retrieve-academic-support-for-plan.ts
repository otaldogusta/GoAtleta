import type {
  ClassGroup,
  ClassPlan,
  DailyLessonPlan,
} from "../../../core/models";
import type { SessionPlanningContext } from "../../../core/session-planning-context";
import { retrieveAcademicPlanningSupport } from "../../../db/academic-knowledge";

type AcademicSupportForPlan = NonNullable<
  SessionPlanningContext["academicSupport"]
>;

const uniqueStrings = (values: (string | null | undefined)[]) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const joinContext = (
  values: (string | null | undefined)[],
  maxLength: number
) => uniqueStrings(values).join(" · ").slice(0, maxLength);

export async function retrieveAcademicSupportForPlan(params: {
  classGroup: ClassGroup;
  classPlan?: ClassPlan | null;
  dailyLessonPlan?: DailyLessonPlan | null;
}): Promise<AcademicSupportForPlan> {
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

  const support = await retrieveAcademicPlanningSupport({
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
    },
    limit: 4,
  });

  return {
    status: support.status,
    references: support.references,
    warnings: support.warnings,
    retrievalMode: support.retrievalMode,
  };
}
