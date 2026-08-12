export type PlanningPdfEvidence = {
  sourceText: string;
  sourceLocation: string;
};

export type PlanningPdfReviewItem = {
  id: string;
  targetField: string;
  label: string;
  category: "keep" | "complement" | "adjust" | "ignore";
  recommendation: "apply" | "review" | "keep_current" | "ignore";
  currentValue: unknown;
  proposedValue: unknown;
  reason: string;
  confidence: number;
  evidence: PlanningPdfEvidence[];
  warnings: string[];
};

export type PlanningPdfDetectedPlan = {
  id: string;
  order: number;
  pageStart: number;
  pageEnd: number;
  title: string;
  lessonDate: string;
  extractedClassName: string;
  extractionConfidence: number;
  warnings: string[];
  items: PlanningPdfReviewItem[];
};

export type PlanningPdfAnalysis = {
  proposalId: string;
  snapshotVersion: string;
  filename: string;
  documentType: "lesson_plan" | "monthly_plan" | "unknown";
  extractionMode: "pdf_text_and_pages";
  extractionConfidence: number;
  processing?: {
    cacheHit: boolean;
    pageCount: number;
    batchCount: number;
    modelAttempts: number;
  };
  classBinding: {
    classId: string;
    selectedClassName: string;
    extractedClassName: string;
    status: "confirmed" | "ambiguous" | "unresolved";
  };
  provenance?: {
    sourceDocumentId: string;
    sourceRevisionId: string;
    contentHash: string;
    filename: string;
    confidence: number;
  };
  warnings: string[];
  plans: PlanningPdfDetectedPlan[];
};

export type PlanningPdfConfirmedPlan = {
  planId: string;
  order: number;
  pageStart: number;
  pageEnd: number;
  approvedValues: Record<string, unknown>;
};

export type PlanningPdfConfirmedBatch = {
  proposalId: string;
  snapshotVersion: string;
  plans: PlanningPdfConfirmedPlan[];
  provenance: {
    sourceDocumentId: string;
    sourceRevisionId: string;
    contentHash: string;
    filename: string;
    confidence: number;
  };
};

export type PlanningPdfConfirmedDraft = PlanningPdfConfirmedBatch;
