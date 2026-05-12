import type { EvidenceConfidence, EvidenceTrace } from "../evidence";
import type { ClassPlan } from "../models";
import type {
  CoachIntervention,
  ScoutingImpact,
  TeamEvent,
  TeamPlanningContext,
  TeamPlanningLoadBias,
  TeamPlanningMode,
} from "../team-context";

export type WeekDecisionReport = {
  id?: string;
  classId: string;
  weekStartDate: string;
  planningMode?: TeamPlanningMode | string;
  loadBias?: TeamPlanningLoadBias | string;
  appliedFocus: string[];
  avoidedSignals: string[];
  scoutingSignals: string[];
  coachInterventions: string[];
  competitiveContext: string[];
  evidenceRuleIds: string[];
  evidenceSummary: string[];
  evidenceConfidence: EvidenceConfidence[] | string[];
  manualOverridePreserved?: boolean;
  summary: string;
  shortReason: string;
};

export type BuildWeekDecisionReportInput = {
  classId: string;
  weekStartDate: string;
  teamPlanningContext?: TeamPlanningContext | null;
  scoutingImpact?: ScoutingImpact | null;
  scoutingImpacts?: ScoutingImpact[] | null;
  coachInterventions?: CoachIntervention[] | null;
  events?: TeamEvent[] | null;
  weekPlan?: ClassPlan | null;
  evidenceTrace?: EvidenceTrace | null;
  manualOverride?: boolean;
};
