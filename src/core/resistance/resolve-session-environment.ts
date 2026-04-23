/**
 * resolve-session-environment.ts
 *
 * Decides the SessionEnvironment for each session in the week
 * based on the team's training context, the total number of weekly sessions,
 * and the session index.
 *
 * Rules (ordered by priority):
 *  1. If the team has no gym access → always "quadra"
 *  2. If integratedTrainingModel === "academia_prioritaria" → distribute more gym sessions
 *  3. If integratedTrainingModel === "academia_integrada" → gym for the mid-week session(s)
 *  4. If integratedTrainingModel === "academia_complementar" → one gym session per 3 court sessions
 *  5. Interference guard: never have two consecutive gym (potência) sessions
 */

import type {
    CourtGymRelationship,
    IntegratedTrainingModel,
    SessionEnvironment,
    TeamTrainingContext,
    WeeklyIntegratedTrainingContext,
    WeeklyPhysicalEmphasis,
} from "../../core/models";
import { supportsResistanceTraining } from "../../core/resistance/training-context";

export type ResolveSessionEnvironmentParams = {
  teamContext: TeamTrainingContext;
  weeklySessions: number;
  sessionIndexInWeek: number; // 0-based
};

/**
 * Returns the SessionEnvironment for a single session.
 */
export function resolveSessionEnvironment(
  params: ResolveSessionEnvironmentParams
): SessionEnvironment {
  const { teamContext, weeklySessions, sessionIndexInWeek } = params;

  if (!supportsResistanceTraining(teamContext)) {
    return "quadra";
  }

  const gymPositions = resolveGymSessionPositions(
    teamContext.integratedTrainingModel,
    weeklySessions
  );

  return gymPositions.has(sessionIndexInWeek) ? "academia" : "quadra";
}

/**
 * Returns a set of 0-based session indices that should be gym sessions.
 */
function resolveGymSessionPositions(
  model: IntegratedTrainingModel,
  weeklySessions: number
): Set<number> {
  const positions = new Set<number>();

  if (model === "quadra_apenas") return positions;

  if (model === "academia_prioritaria") {
    // Leave only first and last sessions on court
    for (let i = 1; i < weeklySessions - 1; i++) {
      positions.add(i);
    }
    return positions;
  }

  if (model === "academia_integrada") {
    // 2 sessions/week → 1 gym (mid = index 1)
    // 3 sessions/week → 1-2 gym (mid sessions)
    // 4+ sessions/week → every other mid session is gym
    if (weeklySessions === 2) {
      positions.add(1);
    } else if (weeklySessions === 3) {
      positions.add(1);
    } else {
      // e.g. 4 sessions: indices 1,3 are gym; 5 sessions: 1,3
      for (let i = 1; i < weeklySessions; i += 2) {
        positions.add(i);
      }
    }
    return positions;
  }

  if (model === "academia_complementar") {
    // 1 gym session per week — always index 1 (mid-cycle day)
    positions.add(Math.min(1, weeklySessions - 1));
    return positions;
  }

  return positions;
}

// ─── Weekly Integrated Context Builder ───────────────────────────────────────

export type BuildWeeklyIntegratedContextParams = {
  teamContext: TeamTrainingContext;
  weeklySessions: number;
  weeklyPhysicalEmphasis?: WeeklyPhysicalEmphasis;
};

/**
 * Builds the WeeklyIntegratedTrainingContext for a class plan week.
 */
export function buildWeeklyIntegratedContext(
  params: BuildWeeklyIntegratedContextParams
): WeeklyIntegratedTrainingContext {
  const { teamContext, weeklySessions } = params;

  if (!supportsResistanceTraining(teamContext)) {
    return {
      weeklyPhysicalEmphasis: params.weeklyPhysicalEmphasis ?? "manutencao",
      courtGymRelationship: "quadra_dominante",
      gymSessionsCount: 0,
      courtSessionsCount: weeklySessions,
      interferenceRisk: "baixo",
      notes: "Turma sem acesso à academia.",
    };
  }

  const gymPositions = resolveGymSessionPositions(
    teamContext.integratedTrainingModel,
    weeklySessions
  );

  const gymSessionsCount = gymPositions.size;
  const courtSessionsCount = weeklySessions - gymSessionsCount;

  const courtGymRelationship = resolveCourtGymRelationship(
    teamContext.integratedTrainingModel,
    courtSessionsCount,
    gymSessionsCount
  );

  const emphasis = params.weeklyPhysicalEmphasis ?? "manutencao";
  const interferenceRisk = resolveInterferenceRisk(emphasis, gymSessionsCount, weeklySessions);

  return {
    weeklyPhysicalEmphasis: emphasis,
    courtGymRelationship,
    gymSessionsCount,
    courtSessionsCount,
    interferenceRisk,
    notes: buildContextNotes(courtGymRelationship, emphasis, interferenceRisk),
  };
}

function resolveCourtGymRelationship(
  model: IntegratedTrainingModel,
  courtSessions: number,
  gymSessions: number
): CourtGymRelationship {
  if (gymSessions === 0) return "quadra_dominante";
  const total = courtSessions + gymSessions;
  const gymRatio = gymSessions / total;

  if (gymRatio >= 0.75) return "academia_prioritaria";
  if (gymRatio <= 0.25) return "quadra_dominante";
  if (model === "academia_integrada") return "integrado_transferencia_direta";
  return "complementar_equilibrado";
}

function resolveInterferenceRisk(
  emphasis: WeeklyPhysicalEmphasis,
  gymSessionsCount: number,
  weeklySessions: number
): "baixo" | "moderado" | "alto" {
  if (gymSessionsCount === 0) return "baixo";

  const isHighPowerEmphasis =
    emphasis === "potencia_atletica" || emphasis === "velocidade_reatividade";
  const gymRatio = gymSessionsCount / weeklySessions;

  if (isHighPowerEmphasis && gymRatio >= 0.5) return "alto";
  if (isHighPowerEmphasis && gymRatio >= 0.25) return "moderado";
  if (gymRatio >= 0.5) return "moderado";
  return "baixo";
}

function buildContextNotes(
  relationship: CourtGymRelationship,
  emphasis: WeeklyPhysicalEmphasis,
  interferenceRisk: "baixo" | "moderado" | "alto"
): string {
  const parts: string[] = [];

  const relationshipLabels: Record<CourtGymRelationship, string> = {
    quadra_dominante: "Quadra dominante",
    complementar_equilibrado: "Distribuição equilibrada entre quadra e academia",
    academia_prioritaria: "Academia como componente principal",
    separado_sem_transferencia: "Academia e quadra independentes",
    integrado_transferencia_direta: "Integração direta academia → quadra",
  };
  parts.push(relationshipLabels[relationship]);

  if (interferenceRisk === "alto") {
    parts.push("⚠ Risco de interferência elevado — monitorar fadiga acumulada");
  } else if (interferenceRisk === "moderado") {
    parts.push("Atenção ao acúmulo de fadiga entre academia e quadra");
  }

  return parts.join(". ");
}
