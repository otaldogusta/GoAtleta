export type AIOrganizationType =
  | "multi_context"
  | "social_project"
  | "sports_program"
  | "sports_school"
  | "club"
  | "personal";

export type AIInstitutionalProfileScope =
  | "workspace"
  | "program"
  | "modality"
  | "class";

export type AIPillarId =
  | "reports"
  | "attendance"
  | "periodization"
  | "preferences"
  | "calendar"
  | "physical_load"
  | "feedback_history"
  | "individual_context";

export type AIAppliedInstitutionalScope = {
  scopeType: AIInstitutionalProfileScope;
  scopeId: string;
  label: string;
};

export type AIInstitutionalProfile = {
  organizationName: string;
  organizationType: AIOrganizationType;
  city?: string;
  state?: string;
  priorities: string[];
  pedagogicalBias: string[];
  pillarWeights: Record<AIPillarId, number>;
  philosophy: string;
  constraints: string[];
  goals: string[];
  equipmentNotes: string;
  communicationPreferences: Record<string, unknown>;
  appliedScopes: AIAppliedInstitutionalScope[];
};

export type AIClassInstitutionalContext = {
  id: string;
  unitId?: string | null;
  unit?: string | null;
  modality?: string | null;
};

export const NEUTRAL_PILLAR_WEIGHTS: Record<AIPillarId, number> = {
  reports: 1,
  attendance: 1,
  periodization: 1,
  preferences: 1,
  calendar: 1,
  physical_load: 1,
  feedback_history: 1,
  individual_context: 1,
};

const PILLAR_IDS = Object.keys(NEUTRAL_PILLAR_WEIGHTS) as AIPillarId[];

const ORGANIZATION_TYPES = new Set<AIOrganizationType>([
  "multi_context",
  "social_project",
  "sports_program",
  "sports_school",
  "club",
  "personal",
]);

const SCOPE_TYPES = new Set<AIInstitutionalProfileScope>([
  "workspace",
  "program",
  "modality",
  "class",
]);

const toStringList = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : undefined;

const toObject = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

const normalizeWeight = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(1.5, Math.max(0.5, parsed));
};

export const normalizeInstitutionalScopeValue = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const buildProgramScopeId = (
  unitId?: string | null,
  unitLabel?: string | null
): string | null => {
  const stableUnitId = String(unitId ?? "").trim();
  if (stableUnitId) return `unit:${stableUnitId}`;
  const normalizedLabel = normalizeInstitutionalScopeValue(unitLabel);
  return normalizedLabel ? `unit_label:${normalizedLabel}` : null;
};

export const buildModalityScopeId = (modality?: string | null): string | null => {
  const normalized = normalizeInstitutionalScopeValue(modality);
  return normalized ? `modality:${normalized}` : null;
};

export const buildClassScopeId = (classId?: string | null): string | null => {
  const normalized = String(classId ?? "").trim();
  return normalized ? `class:${normalized}` : null;
};

const normalizeOrganizationType = (
  value: unknown,
  fallback: AIOrganizationType
): AIOrganizationType => {
  const rawType = String(value ?? "") as AIOrganizationType;
  return ORGANIZATION_TYPES.has(rawType) ? rawType : fallback;
};

const mergeProfileRow = (
  current: AIInstitutionalProfile,
  row: Record<string, unknown>,
  appliedScope?: AIAppliedInstitutionalScope
): AIInstitutionalProfile => {
  const rawWeights = toObject(row.pillar_weights);
  const nextWeights = { ...current.pillarWeights };
  if (rawWeights) {
    PILLAR_IDS.forEach((pillar) => {
      if (rawWeights[pillar] !== undefined && rawWeights[pillar] !== null) {
        nextWeights[pillar] = normalizeWeight(rawWeights[pillar]);
      }
    });
  }

  const communicationPreferences = toObject(row.communication_preferences);
  const priorities = toStringList(row.priorities);
  const pedagogicalBias = toStringList(row.pedagogical_bias);
  const constraints = toStringList(row.constraints);
  const goals = toStringList(row.goals);

  return {
    ...current,
    organizationType: row.organization_type == null
      ? current.organizationType
      : normalizeOrganizationType(row.organization_type, current.organizationType),
    city: row.city == null ? current.city : String(row.city).trim() || undefined,
    state: row.state == null ? current.state : String(row.state).trim() || undefined,
    priorities: priorities ?? current.priorities,
    pedagogicalBias: pedagogicalBias ?? current.pedagogicalBias,
    pillarWeights: nextWeights,
    philosophy: row.philosophy == null
      ? current.philosophy
      : String(row.philosophy).trim(),
    constraints: constraints ?? current.constraints,
    goals: goals ?? current.goals,
    equipmentNotes: row.equipment_notes == null
      ? current.equipmentNotes
      : String(row.equipment_notes).trim(),
    communicationPreferences: communicationPreferences
      ? { ...current.communicationPreferences, ...communicationPreferences }
      : current.communicationPreferences,
    appliedScopes: appliedScope
      ? [...current.appliedScopes, appliedScope]
      : current.appliedScopes,
  };
};

const createNeutralProfile = (organizationName: string): AIInstitutionalProfile => ({
  organizationName: organizationName.trim() || "Workspace ativo",
  organizationType: "multi_context",
  priorities: [],
  pedagogicalBias: [],
  pillarWeights: { ...NEUTRAL_PILLAR_WEIGHTS },
  philosophy: "",
  constraints: [],
  goals: [],
  equipmentNotes: "",
  communicationPreferences: {},
  appliedScopes: [],
});

export function resolveInstitutionalProfile(
  organizationName: string,
  row?: Record<string, unknown> | null
): AIInstitutionalProfile {
  const neutral = createNeutralProfile(organizationName);
  if (!row) return neutral;
  return mergeProfileRow(neutral, row);
}

export function resolveHierarchicalInstitutionalProfile(params: {
  organizationName: string;
  rows?: Array<Record<string, unknown>> | null;
  classContext?: AIClassInstitutionalContext | null;
  legacyRow?: Record<string, unknown> | null;
}): AIInstitutionalProfile {
  const rows = params.rows ?? [];
  const classContext = params.classContext;
  const targetScopeIds: Partial<Record<AIInstitutionalProfileScope, string | null>> = {
    program: buildProgramScopeId(classContext?.unitId, classContext?.unit),
    modality: buildModalityScopeId(classContext?.modality),
    class: buildClassScopeId(classContext?.id),
  };

  const applicableRows = (["workspace", "program", "modality", "class"] as const)
    .flatMap((scopeType) => rows.filter((row) => {
      if (row.active === false) return false;
      if (!SCOPE_TYPES.has(String(row.scope_type) as AIInstitutionalProfileScope)) return false;
      if (String(row.scope_type) !== scopeType) return false;
      if (scopeType === "workspace") return true;
      return String(row.scope_id ?? "") === targetScopeIds[scopeType];
    }));

  if (applicableRows.length === 0 && params.legacyRow) {
    return resolveInstitutionalProfile(params.organizationName, params.legacyRow);
  }

  return applicableRows.reduce<AIInstitutionalProfile>((profile, row) => {
    const scopeType = String(row.scope_type) as AIInstitutionalProfileScope;
    const scopeId = String(row.scope_id ?? "");
    return mergeProfileRow(profile, row, {
      scopeType,
      scopeId,
      label: String(row.scope_label ?? scopeId).trim() || scopeId,
    });
  }, createNeutralProfile(params.organizationName));
}

export function buildInstitutionalProfilePrompt(profile: AIInstitutionalProfile): string {
  const weights = Object.entries(profile.pillarWeights)
    .map(([pillar, weight]) => `${pillar}=${weight.toFixed(2)}`)
    .join(", ");
  const appliedScopes = profile.appliedScopes
    .map((scope) => `${scope.scopeType}:${scope.label}`)
    .join(" -> ");

  return [
    "INSTITUTIONAL_PROFILE: The workspace determines which data you may access; program, modality and class determine how authorized evidence should be interpreted.",
    `Organization: ${profile.organizationName}. Effective type: ${profile.organizationType}.`,
    `Applied interpretation scopes: ${appliedScopes || "neutral global defaults"}.`,
    profile.city || profile.state
      ? `Location: ${[profile.city, profile.state].filter(Boolean).join("/")}.`
      : "Location: not configured.",
    `Priorities: ${profile.priorities.join(", ") || "neutral"}.`,
    `Pedagogical bias: ${profile.pedagogicalBias.join(", ") || "neutral"}.`,
    `Pillar weights: ${weights}.`,
    `Philosophy: ${profile.philosophy || "not configured"}.`,
    `Goals: ${profile.goals.join(", ") || "not configured"}.`,
    `Constraints: ${profile.constraints.join(", ") || "none configured"}.`,
    `Equipment notes: ${profile.equipmentNotes || "none configured"}.`,
    `Communication preferences: ${JSON.stringify(profile.communicationPreferences)}.`,
    "Profiles change emphasis and communication, never authorization or facts. Safety, governance, readiness and explicit evidence always take precedence.",
  ].join("\n");
}
