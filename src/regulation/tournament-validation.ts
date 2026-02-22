import type { RegulationClause } from "../api/regulation-rule-sets";
import {
  resolveBooleanClause,
  resolveClauseMap,
  resolveNumberClause,
  resolveStringArrayClause,
  type RegulationContext,
} from "./clause-engine";

export type TournamentValidationIssue = {
  code: string;
  clauseKey: string;
  severity: "warning" | "error";
  message: string;
};

export type TournamentValidationInput = {
  eventType: string;
  eventSport: string;
  startsAt: Date;
  endsAt: Date;
  locationLabel: string;
  linkedClassCount: number;
  context: RegulationContext;
};

const tournamentDurationMinutes = (startsAt: Date, endsAt: Date) =>
  Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000));

export const validateTournamentWithClauses = (params: {
  clauses: RegulationClause[];
  input: TournamentValidationInput;
}) => {
  const { clauses, input } = params;
  if (input.eventType !== "torneio") return [] as TournamentValidationIssue[];

  const resolved = resolveClauseMap(clauses, input.context);
  const issues: TournamentValidationIssue[] = [];

  const minDuration = Math.max(
    0,
    resolveNumberClause(resolved, "tournament.min_duration_minutes", 60)
  );
  const minLinkedClasses = Math.max(
    0,
    resolveNumberClause(resolved, "tournament.min_linked_classes", 1)
  );
  const maxLinkedClasses = Math.max(
    0,
    resolveNumberClause(resolved, "tournament.max_linked_classes", 0)
  );
  const requireLocation = resolveBooleanClause(
    resolved,
    "tournament.require_location",
    true
  );
  const allowedSports = resolveStringArrayClause(
    resolved,
    "tournament.allowed_event_sports"
  );

  const duration = tournamentDurationMinutes(input.startsAt, input.endsAt);
  if (duration < minDuration) {
    issues.push({
      code: "min_duration_not_met",
      clauseKey: "tournament.min_duration_minutes",
      severity: "error",
      message: `Duração mínima do torneio: ${minDuration} min. Atual: ${duration} min.`,
    });
  }

  if (requireLocation && !input.locationLabel.trim()) {
    issues.push({
      code: "location_required",
      clauseKey: "tournament.require_location",
      severity: "error",
      message: "Este regulamento exige informar o local do torneio.",
    });
  }

  if (input.linkedClassCount < minLinkedClasses) {
    issues.push({
      code: "min_linked_classes_not_met",
      clauseKey: "tournament.min_linked_classes",
      severity: "warning",
      message: `Recomendado vincular ao menos ${minLinkedClasses} turma(s).`,
    });
  }

  if (maxLinkedClasses > 0 && input.linkedClassCount > maxLinkedClasses) {
    issues.push({
      code: "max_linked_classes_exceeded",
      clauseKey: "tournament.max_linked_classes",
      severity: "warning",
      message: `Este regulamento recomenda no máximo ${maxLinkedClasses} turma(s).`,
    });
  }

  if (allowedSports.length) {
    const sport = String(input.eventSport ?? "").trim().toLowerCase();
    if (sport && !allowedSports.includes(sport)) {
      issues.push({
        code: "sport_not_allowed",
        clauseKey: "tournament.allowed_event_sports",
        severity: "warning",
        message: `Esporte "${input.eventSport}" não está na lista recomendada do regulamento.`,
      });
    }
  }

  return issues;
};
