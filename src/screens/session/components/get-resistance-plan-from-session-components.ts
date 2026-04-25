import type {
  ResistanceTrainingPlan,
  SessionComponent,
  SessionComponentAcademiaResistido,
} from "../../../core/models";

export type ResistanceSessionComponentPreview = {
  component: SessionComponentAcademiaResistido;
  resistancePlan: ResistanceTrainingPlan;
  durationMin: number;
};

export function getResistancePlanFromSessionComponents(
  sessionComponents?: SessionComponent[] | null,
): ResistanceSessionComponentPreview | null {
  const component = sessionComponents?.find(
    (item): item is SessionComponentAcademiaResistido =>
      item?.type === "academia_resistido" &&
      typeof item === "object" &&
      Boolean(item.resistancePlan),
  );

  if (!component?.resistancePlan) {
    return null;
  }

  return {
    component,
    resistancePlan: component.resistancePlan,
    durationMin:
      component.durationMin || component.resistancePlan.estimatedDurationMin || 0,
  };
}
