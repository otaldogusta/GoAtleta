import type { EventSport, EventType } from "../api/events";
import {
  listRegulationClauses,
  peekRuleSetForNewCycle,
  type RegulationClause,
} from "../api/regulation-rule-sets";
import {
  type TournamentValidationIssue,
  validateTournamentWithClauses,
} from "./tournament-validation";

export type TournamentRuleCheckResult = {
  ruleSetId: string | null;
  clauses: RegulationClause[];
  issues: TournamentValidationIssue[];
};

export const validateTournamentRules = async (params: {
  organizationId: string;
  eventType: EventType;
  eventSport: EventSport;
  startsAt: Date;
  endsAt: Date;
  locationLabel: string;
  linkedClassCount: number;
  unitId?: string | null;
  existingRuleSetId?: string | null;
}) => {
  if (params.eventType !== "torneio") {
    return {
      ruleSetId: null,
      clauses: [],
      issues: [],
    } as TournamentRuleCheckResult;
  }

  const existingRuleSetId = String(params.existingRuleSetId ?? "").trim() || null;
  const resolvedRuleSetId =
    existingRuleSetId ||
    (await peekRuleSetForNewCycle({
      organizationId: params.organizationId,
      eventSport: params.eventSport,
    }));

  if (!resolvedRuleSetId) {
    return {
      ruleSetId: null,
      clauses: [],
      issues: [],
    } as TournamentRuleCheckResult;
  }

  const clauses = await listRegulationClauses({
    organizationId: params.organizationId,
    ruleSetId: resolvedRuleSetId,
  });

  const issues = validateTournamentWithClauses({
    clauses,
    input: {
      eventType: params.eventType,
      eventSport: params.eventSport,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      locationLabel: params.locationLabel,
      linkedClassCount: params.linkedClassCount,
      context: {
        organizationId: params.organizationId,
        eventType: params.eventType,
        eventSport: params.eventSport,
        unitId: params.unitId,
      },
    },
  });

  return {
    ruleSetId: resolvedRuleSetId,
    clauses,
    issues,
  } as TournamentRuleCheckResult;
};
