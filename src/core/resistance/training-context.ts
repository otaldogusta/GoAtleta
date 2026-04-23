/**
 * training-context.ts
 *
 * Derives TeamTrainingContext from a ClassGroup.
 * The Equipment field is the single source of truth for gym access;
 * explicit overrides on ClassGroup (integratedTrainingModel,
 * resistanceTrainingProfile) take precedence when present.
 */

import type {
    ClassGroup,
    Equipment,
    IntegratedTrainingModel,
    ResistanceTrainingProfile,
    TeamTrainingContext,
} from "../models";

/**
 * Derives the IntegratedTrainingModel from the Equipment field alone.
 * Use this when no explicit override is stored on the class record.
 */
export function deriveIntegratedTrainingModel(
  equipment: Equipment
): IntegratedTrainingModel {
  switch (equipment) {
    case "academia":
      return "academia_integrada";
    case "misto":
      return "academia_complementar";
    case "funcional":
    case "quadra":
    default:
      return "quadra_apenas";
  }
}

/**
 * Returns true when the class group has physical access to a gym.
 */
export function hasGymAccess(equipment: Equipment): boolean {
  return equipment === "academia" || equipment === "misto";
}

/**
 * Builds a TeamTrainingContext from a ClassGroup record.
 * Explicit class-level overrides take priority over derived values.
 */
export function resolveTeamTrainingContext(
  classGroup: Pick<ClassGroup, "equipment" | "integratedTrainingModel" | "resistanceTrainingProfile">
): TeamTrainingContext {
  const gymAccess = hasGymAccess(classGroup.equipment);

  const integratedTrainingModel: IntegratedTrainingModel =
    classGroup.integratedTrainingModel ??
    deriveIntegratedTrainingModel(classGroup.equipment);

  const resistanceTrainingProfile: ResistanceTrainingProfile =
    classGroup.resistanceTrainingProfile ?? "iniciante";

  return {
    hasGymAccess: gymAccess,
    integratedTrainingModel,
    resistanceTrainingProfile,
  };
}

/**
 * Returns true when the team context indicates resistance training
 * should be included in the periodization output.
 */
export function supportsResistanceTraining(ctx: TeamTrainingContext): boolean {
  return (
    ctx.hasGymAccess &&
    ctx.integratedTrainingModel !== "quadra_apenas"
  );
}
