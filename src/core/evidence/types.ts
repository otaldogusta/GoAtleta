export type EvidenceRuleType =
  | "scientific_principle"
  | "evidence_informed"
  | "operational_heuristic"
  | "safety_guard"
  | "product_decision";

export type EvidenceConfidence = "low" | "medium" | "high";

export type EvidenceDomain =
  | "training_load"
  | "periodization"
  | "youth_development"
  | "motor_learning"
  | "sport_pedagogy"
  | "scouting"
  | "match_context"
  | "recovery"
  | "safety"
  | "coach_override";

export type EvidenceSourceType =
  | "book"
  | "paper"
  | "guideline"
  | "position_statement"
  | "internal_review"
  | "operational_rule"
  | "pending_reference";

export type EvidenceSource = {
  id: string;
  title: string;
  type: EvidenceSourceType;
  authors?: string;
  year?: number;
  citation?: string;
  url?: string;
  notes?: string;
  reviewRequired?: boolean;
};

export type EvidenceApplicationContext = {
  classAgeBand?: string;
  modality?: string;
  sessionType?: string;
  planningMode?: string;
  hasUpcomingMatch?: boolean;
  daysUntilMatch?: number;
  hasRecentScoutingImpact?: boolean;
  hasCoachIntervention?: boolean;
  youth?: boolean;
  manualOverride?: boolean;
  loadIntent?: string;
  scoutingSampleSize?: number;
};

export type EvidenceRule = {
  id: string;
  label: string;
  type: EvidenceRuleType;
  domain: EvidenceDomain[];
  confidence: EvidenceConfidence;
  appliesWhen: string[];
  avoidWhen?: string[];
  recommendation: string;
  rationale: string;
  limitations?: string[];
  implementationNotes?: string[];
  sourceIds: string[];
  tags?: string[];
};

export type EvidenceTrace = {
  evidenceRuleIds: string[];
  evidenceSummary: string[];
  confidence: EvidenceConfidence[];
};
