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

export type ResistanceEligibilityMode =
  | "none"
  | "motor_control_integrated"
  | "adapted_support"
  | "formal_support"
  | "formal_priority";

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

function getAgeBandLowerBound(ageBand: string | undefined): number | null {
  const match = String(ageBand ?? "").match(/(\d{2})/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function isBeginnerMvLevel(mvLevel: string | undefined): boolean {
  const normalized = String(mvLevel ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes("inic") ||
    normalized.includes("base") ||
    normalized === "mv1"
  );
}

export function resolveResistanceEligibilityMode(params: {
  classGroup: Pick<ClassGroup, "ageBand" | "level" | "mvLevel" | "modality">;
  teamContext: TeamTrainingContext;
}): ResistanceEligibilityMode {
  const { classGroup, teamContext } = params;

  if (!teamContext.hasGymAccess || teamContext.integratedTrainingModel === "quadra_apenas") {
    return "none";
  }

  const lowerAgeBound = getAgeBandLowerBound(classGroup.ageBand);
  const isVolleyball = classGroup.modality === "voleibol";
  const isBeginnerClass =
    classGroup.level === 1 || isBeginnerMvLevel(classGroup.mvLevel);
  const isYoungGroup = lowerAgeBound !== null && lowerAgeBound <= 9;
  const isPreFormationGroup = lowerAgeBound !== null && lowerAgeBound <= 12;

  if (isVolleyball && isYoungGroup) {
    return "motor_control_integrated";
  }

  if (
    isVolleyball &&
    isPreFormationGroup &&
    (isBeginnerClass || teamContext.resistanceTrainingProfile === "iniciante")
  ) {
    return "adapted_support";
  }

  if (
    lowerAgeBound !== null &&
    lowerAgeBound >= 15 &&
    teamContext.resistanceTrainingProfile === "avancado" &&
    teamContext.integratedTrainingModel === "academia_prioritaria"
  ) {
    return "formal_priority";
  }

  return "formal_support";
}

/**
 * Returns true when the team context indicates resistance training
 * should be included in the periodization output.
 */
export function supportsResistanceTraining(
  ctx: TeamTrainingContext,
  classGroup?: Pick<ClassGroup, "ageBand" | "level" | "mvLevel" | "modality"> | null
): boolean {
  if (classGroup) {
    const eligibilityMode = resolveResistanceEligibilityMode({
      classGroup,
      teamContext: ctx,
    });
    return eligibilityMode === "formal_support" || eligibilityMode === "formal_priority";
  }

  return (
    ctx.hasGymAccess &&
    ctx.integratedTrainingModel !== "quadra_apenas"
  );
}
