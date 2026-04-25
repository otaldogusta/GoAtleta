/**
 * build-resistance-session-plan.ts
 *
 * Selects a resistance template and builds a SessionComponentAcademiaResistido
 * based on the weekly training context, the session role, and the team profile.
 */

import type {
    ResistanceTrainingGoal,
    SessionComponentAcademiaResistido,
    TeamTrainingContext,
    WeeklyIntegratedTrainingContext,
    WeekSessionRole,
} from "../../core/models";
import { resolveResistanceTemplate } from "./resistance-templates";

export type BuildResistanceSessionPlanParams = {
  teamContext: TeamTrainingContext;
  weeklyContext: WeeklyIntegratedTrainingContext;
  sessionRole: WeekSessionRole;
};

/**
 * Maps a weekly physical emphasis + session role to a ResistanceTrainingGoal.
 *
 * Priority rules:
 *  - Closing/synthesis sessions → prevencao_lesao (unloading)
 *  - Power emphasis → potencia_atletica
 *  - Base/intro sessions with any gym access → forca_base
 *  - Consolidation → hipertrofia or resistencia_muscular based on profile
 *  - Default → forca_base
 */
function resolveGoalForSession(
  weeklyContext: WeeklyIntegratedTrainingContext,
  sessionRole: WeekSessionRole
): ResistanceTrainingGoal {
  const { weeklyPhysicalEmphasis } = weeklyContext;

  // Closing sessions should reduce load
  if (
    sessionRole === "sintese_fechamento" ||
    sessionRole === "transferencia_jogo"
  ) {
    return "prevencao_lesao";
  }

  switch (weeklyPhysicalEmphasis) {
    case "potencia_atletica":
    case "velocidade_reatividade":
      return "potencia_atletica";
    case "forca_base":
      return "forca_base";
    case "resistencia_especifica":
      return "resistencia_muscular";
    case "prevencao_recuperacao":
      return "prevencao_lesao";
    case "manutencao":
      return sessionRole === "introducao_exploracao"
        ? "ativacao_funcional"
        : "forca_base";
    default:
      return "forca_base";
  }
}

/**
 * Builds the gym block for a session that is fully or partially in academia.
 */
export function buildResistanceSessionPlan(
  params: BuildResistanceSessionPlanParams
): SessionComponentAcademiaResistido {
  const { teamContext, weeklyContext, sessionRole } = params;

  const goal = resolveGoalForSession(weeklyContext, sessionRole);
  const resistancePlan = resolveResistanceTemplate(
    goal,
    teamContext.resistanceTrainingProfile,
    {
      weeklyPhysicalEmphasis: weeklyContext.weeklyPhysicalEmphasis,
      courtGymRelationship: weeklyContext.courtGymRelationship,
    }
  );

  return {
    type: "academia_resistido",
    resistancePlan,
    durationMin: resistancePlan.estimatedDurationMin,
  };
}
