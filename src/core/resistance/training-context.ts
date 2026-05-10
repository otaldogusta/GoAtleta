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
    ResistanceTrainingContextDecision,
    ResistanceTrainingContextSource,
    ResistanceSportContext,
    ResistanceTrainingContext,
    SessionEnvironment,
    SessionPrimaryComponent,
    ResistanceTrainingProfile,
    TeamTrainingContext,
} from "../models";

export type ResistanceEligibilityMode =
  | "none"
  | "motor_control_integrated"
  | "adapted_support"
  | "formal_support"
  | "formal_priority";

export const RESISTANCE_TRAINING_CONTEXT_LABELS: Record<
  ResistanceTrainingContext,
  string
> = {
  general_fitness: "Condicionamento geral",
  health: "Saúde e movimento",
  strength: "Força",
  hypertrophy: "Hipertrofia",
  weight_loss: "Emagrecimento",
  rehabilitation_light: "Prevenção e retorno",
  school: "Contexto escolar",
  volleyball: "Vôlei",
  soccer: "Futebol",
  running: "Corrida",
  basketball: "Basquete",
  other_sport: "Outro esporte",
};

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

export function resolveResistanceTrainingContext(
  modality?: ClassGroup["modality"] | null
): ResistanceTrainingContext {
  switch (modality) {
    case "voleibol":
      return "volleyball";
    case "futebol":
    case "futsal":
      return "soccer";
    case "basquete":
      return "basketball";
    case "fitness":
      return "general_fitness";
    default:
      return "school";
  }
}

export function formatResistanceTrainingContextLabel(
  trainingContext?: ResistanceTrainingContext | null
): string {
  if (!trainingContext) return "Condicionamento geral";
  return RESISTANCE_TRAINING_CONTEXT_LABELS[trainingContext] ?? "Condicionamento geral";
}

function resolveResistanceSportContext(
  trainingContext: ResistanceTrainingContext
): ResistanceSportContext | undefined {
  if (
    trainingContext === "volleyball" ||
    trainingContext === "soccer" ||
    trainingContext === "running" ||
    trainingContext === "basketball"
  ) {
    return trainingContext;
  }
  return undefined;
}

export { resolveResistanceSportContext };

const isResistanceEnvironment = (environment?: SessionEnvironment | null) =>
  environment === "academia" || environment === "mista";

const isResistancePrimaryComponent = (
  component?: SessionPrimaryComponent | null
) => component === "resistido" || component === "misto_transferencia";

const resolveSportContextFromOverride = (
  trainingContext: ResistanceTrainingContext,
  sportContext?: ResistanceSportContext | null
) => {
  if (sportContext) return sportContext;
  return resolveResistanceSportContext(trainingContext);
};

const buildTrainingContextDecision = (params: {
  trainingContext: ResistanceTrainingContext;
  sportContext?: ResistanceSportContext;
  source: ResistanceTrainingContextSource;
  confidence: ResistanceTrainingContextDecision["confidence"];
  reason: string;
}): ResistanceTrainingContextDecision => ({
  trainingContext: params.trainingContext,
  sportContext: params.sportContext,
  source: params.source,
  confidence: params.confidence,
  reason: params.reason,
});

export function resolveTrainingContextFromPlanningContext(params: {
  classGroup?: Pick<ClassGroup, "modality" | "goal"> | null;
  sessionEnvironment?: SessionEnvironment | null;
  sessionPrimaryComponent?: SessionPrimaryComponent | null;
  physicalFocus?: string | null;
  dominantBlock?: string | null;
  overrideTrainingContext?: ResistanceTrainingContext | null;
  overrideSportContext?: ResistanceSportContext | null;
  weeklyTrainingContext?: ResistanceTrainingContext | null;
  weeklySportContext?: ResistanceSportContext | null;
}): ResistanceTrainingContextDecision {
  if (params.overrideTrainingContext) {
    const trainingContext = params.overrideTrainingContext;
    return buildTrainingContextDecision({
      trainingContext,
      sportContext: resolveSportContextFromOverride(
        trainingContext,
        params.overrideSportContext
      ),
      source: "manual_override",
      confidence: "high",
      reason: `Professor definiu manualmente o foco do treino como ${formatResistanceTrainingContextLabel(trainingContext).toLowerCase()}.`,
    });
  }

  if (params.weeklyTrainingContext) {
    const trainingContext = params.weeklyTrainingContext;
    return buildTrainingContextDecision({
      trainingContext,
      sportContext: resolveSportContextFromOverride(
        trainingContext,
        params.weeklySportContext
      ),
      source: "weekly_strategy",
      confidence: "high",
      reason: `A periodização da sessão definiu ${formatResistanceTrainingContextLabel(trainingContext).toLowerCase()} como contexto principal.`,
    });
  }

  const derivedFromModality = resolveResistanceTrainingContext(
    params.classGroup?.modality
  );
  const sportFromModality = resolveResistanceSportContext(derivedFromModality);
  const resistanceSession =
    isResistanceEnvironment(params.sessionEnvironment) ||
    isResistancePrimaryComponent(params.sessionPrimaryComponent);

  if (resistanceSession) {
    if (sportFromModality) {
      return buildTrainingContextDecision({
        trainingContext: derivedFromModality,
        sportContext: sportFromModality,
        source: "class_modality",
        confidence: "medium",
        reason: `Sessão resistida alinhada à modalidade principal da turma: ${formatResistanceTrainingContextLabel(derivedFromModality)}.`,
      });
    }

    if (derivedFromModality === "general_fitness") {
      return buildTrainingContextDecision({
        trainingContext: "general_fitness",
        source: "class_modality",
        confidence: "medium",
        reason: "Sessão resistida sem esporte específico; usado condicionamento geral como contexto principal.",
      });
    }

    return buildTrainingContextDecision({
      trainingContext: "general_fitness",
      source: "fallback",
      confidence: "medium",
      reason: "Sessão resistida sem modalidade esportiva explícita; usado condicionamento geral como fallback seguro.",
    });
  }

  if (sportFromModality) {
    return buildTrainingContextDecision({
      trainingContext: derivedFromModality,
      sportContext: sportFromModality,
      source: "class_modality",
      confidence: "medium",
      reason: `Contexto derivado da modalidade principal da turma: ${formatResistanceTrainingContextLabel(derivedFromModality)}.`,
    });
  }

  if (derivedFromModality === "general_fitness") {
    return buildTrainingContextDecision({
      trainingContext: "general_fitness",
      source: "class_modality",
      confidence: "medium",
      reason: "Contexto derivado da modalidade fitness da turma.",
    });
  }

  return buildTrainingContextDecision({
    trainingContext: "general_fitness",
    source: "fallback",
    confidence: "low",
    reason: "Sem decisão explícita de contexto; usado condicionamento geral como fallback seguro.",
  });
}

/**
 * Builds a TeamTrainingContext from a ClassGroup record.
 * Explicit class-level overrides take priority over derived values.
 */
export function resolveTeamTrainingContext(
  classGroup: Pick<ClassGroup, "equipment" | "integratedTrainingModel" | "resistanceTrainingProfile"> &
    Partial<Pick<ClassGroup, "modality">>
): TeamTrainingContext {
  const gymAccess = hasGymAccess(classGroup.equipment);

  const integratedTrainingModel: IntegratedTrainingModel =
    classGroup.integratedTrainingModel ??
    deriveIntegratedTrainingModel(classGroup.equipment);

  const resistanceTrainingProfile: ResistanceTrainingProfile =
    classGroup.resistanceTrainingProfile ?? "iniciante";
  const trainingContext = resolveResistanceTrainingContext(classGroup.modality);

  return {
    hasGymAccess: gymAccess,
    integratedTrainingModel,
    resistanceTrainingProfile,
    trainingContext,
    sportContext: resolveResistanceSportContext(trainingContext),
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
  const isVolleyball = teamContext.trainingContext === "volleyball";
  const isSchoolContext = teamContext.trainingContext === "school";
  const isBeginnerClass =
    classGroup.level === 1 || isBeginnerMvLevel(classGroup.mvLevel);
  const isYoungGroup = lowerAgeBound !== null && lowerAgeBound <= 9;
  const isPreFormationGroup = lowerAgeBound !== null && lowerAgeBound <= 12;

  if ((isVolleyball || isSchoolContext) && isYoungGroup) {
    return "motor_control_integrated";
  }

  if (
    (isVolleyball || isSchoolContext) &&
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
