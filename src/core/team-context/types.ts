import type { EvidenceConfidence, EvidenceTrace } from "../evidence";

export type TeamEventType =
  | "training"
  | "friendly"
  | "official_match"
  | "evaluation"
  | "festival"
  | "meeting"
  | "recovery";

export type TeamEventImportance = "low" | "medium" | "high";

export type TeamEvent = {
  id: string;
  classId: string;
  title: string;
  type: TeamEventType;
  date: string;
  importance: TeamEventImportance;
  opponent?: string;
  location?: string;
  notes?: string;
  createdAt: string;
};

export type CoachInterventionType =
  | "technical"
  | "tactical"
  | "physical"
  | "behavioral"
  | "emotional";

export type CoachIntervention = {
  id: string;
  classId: string;
  date: string;
  type: CoachInterventionType;
  summary: string;
  tags: string[];
  relatedEventId?: string;
  createdAt: string;
};

export type ScoutingLoadImpact = "reduce" | "maintain" | "increase";

export type ScoutingImpact = {
  id: string;
  classId: string;
  eventId: string;
  date: string;
  strengths: string[];
  weaknesses: string[];
  tacticalNotes: string[];
  recommendedFocus: string[];
  loadImpact: ScoutingLoadImpact;
  evidenceTrace?: EvidenceTrace;
  evidenceRuleIds?: string[];
  evidenceSummary?: string[];
  evidenceConfidence?: EvidenceConfidence[];
  createdAt: string;
};

export type TeamPlanningMode =
  | "normal"
  | "pre_match"
  | "post_match"
  | "recovery"
  | "evaluation";

export type TeamPlanningLoadBias = "reduce" | "maintain" | "increase";

export type TeamPlanningContext = {
  hasUpcomingMatch: boolean;
  daysUntilMatch: number | null;
  planningMode: TeamPlanningMode;
  recommendedLoadBias: TeamPlanningLoadBias;
  focusHints: string[];
  avoidHints: string[];
  reason: string;
};

export type TeamEventDateRange = {
  startDate: string;
  endDate: string;
};

export type ResolveTeamPlanningContextInput = {
  classId: string;
  referenceDate: string;
  events?: TeamEvent[];
  coachInterventions?: CoachIntervention[];
  scoutingImpacts?: ScoutingImpact[];
  upcomingWindowDays?: number;
  recentWindowDays?: number;
};
