import {
  resolveTeamPlanningContext,
  type CoachIntervention,
  type CoachInterventionType,
  type TeamEvent,
  type TeamEventImportance,
  type TeamEventType,
} from "../../core/team-context";
import {
  createCoachInterventionRecord,
  createTeamEventRecord,
  listCoachInterventionRecords,
  listScoutingImpactRecords,
  listTeamEventRecords,
} from "./team-context-store";

export type CreateTeamEventInput = {
  classId: string;
  title: string;
  type: TeamEventType;
  date: string;
  importance: TeamEventImportance;
  opponent?: string;
  location?: string;
  notes?: string;
};

export type CreateCoachInterventionInput = {
  classId: string;
  date: string;
  type: CoachInterventionType;
  summary: string;
  tags?: string[];
  relatedEventId?: string;
};

const buildId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const cleanOptional = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : undefined;
};

export const normalizeTags = (value: string | string[] | undefined) => {
  const tags = Array.isArray(value) ? value : String(value ?? "").split(/[,\n;|]+/);
  return Array.from(
    new Set(
      tags
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
};

export async function createTeamEvent(input: CreateTeamEventInput): Promise<TeamEvent> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Título do evento é obrigatório.");
  }
  if (!input.date.trim()) {
    throw new Error("Data do evento é obrigatória.");
  }
  const event: TeamEvent = {
    id: buildId("team_event"),
    classId: input.classId,
    title,
    type: input.type,
    date: input.date,
    importance: input.importance,
    opponent: cleanOptional(input.opponent),
    location: cleanOptional(input.location),
    notes: cleanOptional(input.notes),
    createdAt: new Date().toISOString(),
  };
  return createTeamEventRecord(event);
}

export async function listTeamEvents(classId: string) {
  return listTeamEventRecords(classId);
}

export async function createCoachIntervention(
  input: CreateCoachInterventionInput
): Promise<CoachIntervention> {
  const summary = input.summary.trim();
  if (!summary) {
    throw new Error("Resumo da intervenção é obrigatório.");
  }
  if (!input.date.trim()) {
    throw new Error("Data da intervenção é obrigatória.");
  }
  const intervention: CoachIntervention = {
    id: buildId("coach_intervention"),
    classId: input.classId,
    date: input.date,
    type: input.type,
    summary,
    tags: normalizeTags(input.tags),
    relatedEventId: cleanOptional(input.relatedEventId),
    createdAt: new Date().toISOString(),
  };
  return createCoachInterventionRecord(intervention);
}

export async function listCoachInterventions(classId: string) {
  return listCoachInterventionRecords(classId);
}

export async function buildTeamPlanningContextSummary(classId: string, referenceDate: string) {
  const [events, interventions, scoutingImpacts] = await Promise.all([
    listTeamEventRecords(classId),
    listCoachInterventionRecords(classId),
    listScoutingImpactRecords(classId),
  ]);

  const context = resolveTeamPlanningContext({
    classId,
    referenceDate,
    events,
    coachInterventions: interventions,
    scoutingImpacts,
  });

  const planningModeLabel =
    context.planningMode === "pre_match"
      ? "Pré-jogo"
      : context.planningMode === "post_match"
      ? "Pós-jogo"
      : context.planningMode === "recovery"
      ? "Recuperação"
      : context.planningMode === "evaluation"
      ? "Avaliação"
      : "Normal";

  const loadBiasLabel =
    context.recommendedLoadBias === "reduce"
      ? "Reduzir carga"
      : context.recommendedLoadBias === "increase"
      ? "Aumentar carga"
      : "Manter carga";

  return {
    context,
    planningModeLabel,
    loadBiasLabel,
    events,
    interventions,
    scoutingImpacts,
  };
}
