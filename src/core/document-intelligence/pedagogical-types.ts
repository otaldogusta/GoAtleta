export type DocumentType = "monthly_plan" | "monthly_report" | "unknown";

export type ExtractedField<T> = {
  value: T | null;
  confidence: number;
  sourceText?: string;
  warnings: string[];
};

export type PedagogicalDimension = {
  conceptual?: string;
  attitudinal?: string;
  procedural?: string;
};

export type ExtractedLesson = {
  date: string;
  startTime?: string;
  endTime?: string;
  generalObjective?: string;
  dimensions: PedagogicalDimension;
  problemSituation?: string;
  activities: string[];
};

export type ExtractedReport = {
  date: string;
  participantCount?: number;
  conclusion: string;
  difficulties: string[];
  adaptations: string[];
};

export type DocumentInterpretation = {
  sourceDocumentId: string;
  documentType: DocumentType;
  className: ExtractedField<string>;
  period: ExtractedField<string>;
  lessons: ExtractedLesson[];
  reports: ExtractedReport[];
  duplicateBlocksIgnored: number;
  warnings: string[];
  extractionConfidence: number;
};

export type DocumentMergeTarget =
  | "cycle"
  | "session"
  | "report"
  | "event"
  | "deadline"
  | "class_structure"
  | "student_enrollment"
  | "student_progression";

export type ReconciliationKind =
  | "new_information"
  | "complement"
  | "conflict"
  | "stale_information"
  | "duplicate";

export type DocumentMergeItem = {
  id: string;
  kind: ReconciliationKind;
  targetType: DocumentMergeTarget;
  category: "keep" | "complement" | "adjust" | "ignore";
  currentValue: unknown;
  proposedValue: unknown;
  recommendation: "apply" | "review" | "keep_current" | "ignore";
  reason: string;
  recommendationConfidence: number;
};

export type AppPlanningSnapshot = {
  version: string;
  organizationId: string;
  classId: string;
  period: string;
  currentFocus: string;
  progression: string;
  plannedSessionDates: string[];
  completedReports: Array<{
    date: string;
    conclusion: string;
    successfulDirectReceptionCount?: number;
  }>;
};
