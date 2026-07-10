import type { AdaptiveLessonEnvelope, ClassReadinessState } from "./models";
import type { PedagogicalDimensionsProfile } from "./pedagogical-dimensions-types";

export type WorkspaceOrganizationType =
  | "social_project"
  | "sports_school"
  | "club"
  | "personal";

export type InstitutionalPillarId =
  | "reports"
  | "attendance"
  | "periodization"
  | "preferences"
  | "calendar"
  | "physical_load"
  | "feedback_history"
  | "individual_context";

export type WorkspaceInstitutionalProfile = {
  organizationType: WorkspaceOrganizationType;
  priorities: string[];
  pedagogicalBias: string[];
  pillarWeights: Record<InstitutionalPillarId, number>;
  philosophy: string;
  constraints: string[];
  goals: string[];
  equipmentNotes: string;
};

export type WorkspaceContext = {
  workspaceId: string;
  organizationName: string;
  organizationType: WorkspaceOrganizationType;
  location?: {
    city: string;
    state: string;
  };
  institutionalProfile?: WorkspaceInstitutionalProfile;
  activeClassId?: string;
  activeStudentId?: string;
};

export type AiMemoryScope = "user_global" | "workspace" | "class" | "student";

export type PillarEvidenceState = {
  pillarId: string;
  status: "missing" | "partial" | "sufficient" | "conflicting";
  evidenceIds: string[];
  summary: string;
};

export type PedagogicalProgressionCondition = {
  id: string;
  description: string;
  completed: boolean;
};

export type PedagogicalContextFusionSnapshot = {
  workspace: WorkspaceContext;
  scope: AiMemoryScope;
  evidenceByPillar: PillarEvidenceState[];
  readinessState: ClassReadinessState;
  pedagogicalDimensions: PedagogicalDimensionsProfile;
  adaptiveEnvelope: AdaptiveLessonEnvelope;
  recommendedDecision: string;
  progressionConditions: PedagogicalProgressionCondition[];
  humanReasons: string[];
  generatedAt: string;
};

export const buildWorkspaceScopeKey = (
  workspaceId: string,
  entityId: string
): string => `${workspaceId.trim()}:${entityId.trim()}`;
