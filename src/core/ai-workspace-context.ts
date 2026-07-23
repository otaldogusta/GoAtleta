import type { AdaptiveLessonEnvelope, ClassReadinessState } from "./models";
import type { PedagogicalDimensionsProfile } from "./pedagogical-dimensions-types";

export type WorkspaceOrganizationType =
  | "multi_context"
  | "social_project"
  | "sports_program"
  | "sports_school"
  | "club"
  | "personal";

export type InstitutionalProfileScope =
  | "workspace"
  | "program"
  | "modality"
  | "class";

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
  communicationPreferences: Record<string, unknown>;
  appliedScopes: {
    scopeType: InstitutionalProfileScope;
    scopeId: string;
    label: string;
  }[];
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

export const normalizeInstitutionalScopeValue = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const buildInstitutionalScopeId = (params: {
  scopeType: InstitutionalProfileScope;
  workspaceId?: string | null;
  unitId?: string | null;
  unitLabel?: string | null;
  modality?: string | null;
  classId?: string | null;
}): string | null => {
  if (params.scopeType === "workspace") {
    const workspaceId = String(params.workspaceId ?? "").trim();
    return workspaceId ? `workspace:${workspaceId}` : null;
  }
  if (params.scopeType === "program") {
    const unitId = String(params.unitId ?? "").trim();
    if (unitId) return `unit:${unitId}`;
    const unitLabel = normalizeInstitutionalScopeValue(params.unitLabel);
    return unitLabel ? `unit_label:${unitLabel}` : null;
  }
  if (params.scopeType === "modality") {
    const modality = normalizeInstitutionalScopeValue(params.modality);
    return modality ? `modality:${modality}` : null;
  }
  const classId = String(params.classId ?? "").trim();
  return classId ? `class:${classId}` : null;
};
