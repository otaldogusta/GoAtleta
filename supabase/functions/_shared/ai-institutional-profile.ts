export type AIOrganizationType =
  | "social_project"
  | "sports_school"
  | "club"
  | "personal";

export type AIPillarId =
  | "reports"
  | "attendance"
  | "periodization"
  | "preferences"
  | "calendar"
  | "physical_load"
  | "feedback_history"
  | "individual_context";

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

const ORGANIZATION_TYPES = new Set<AIOrganizationType>([
  "social_project",
  "sports_school",
  "club",
  "personal",
]);

const toStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];

const normalizeWeight = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(1.5, Math.max(0.5, parsed));
};

export function resolveInstitutionalProfile(
  organizationName: string,
  row?: Record<string, unknown> | null
): AIInstitutionalProfile {
  const rawType = String(row?.organization_type ?? "club") as AIOrganizationType;
  const organizationType = ORGANIZATION_TYPES.has(rawType) ? rawType : "club";
  const rawWeights = row?.pillar_weights && typeof row.pillar_weights === "object"
    ? row.pillar_weights as Record<string, unknown>
    : {};

  return {
    organizationName: organizationName.trim() || "Workspace ativo",
    organizationType,
    city: String(row?.city ?? "").trim() || undefined,
    state: String(row?.state ?? "").trim() || undefined,
    priorities: toStringList(row?.priorities),
    pedagogicalBias: toStringList(row?.pedagogical_bias),
    pillarWeights: {
      reports: normalizeWeight(rawWeights.reports),
      attendance: normalizeWeight(rawWeights.attendance),
      periodization: normalizeWeight(rawWeights.periodization),
      preferences: normalizeWeight(rawWeights.preferences),
      calendar: normalizeWeight(rawWeights.calendar),
      physical_load: normalizeWeight(rawWeights.physical_load),
      feedback_history: normalizeWeight(rawWeights.feedback_history),
      individual_context: normalizeWeight(rawWeights.individual_context),
    },
    philosophy: String(row?.philosophy ?? "").trim(),
    constraints: toStringList(row?.constraints),
    goals: toStringList(row?.goals),
    equipmentNotes: String(row?.equipment_notes ?? "").trim(),
  };
}

export function buildInstitutionalProfilePrompt(profile: AIInstitutionalProfile): string {
  const weights = Object.entries(profile.pillarWeights)
    .map(([pillar, weight]) => `${pillar}=${weight.toFixed(2)}`)
    .join(", ");

  return [
    "INSTITUTIONAL_PROFILE: Use this profile only to weight and communicate evidence inside the active workspace.",
    `Organization: ${profile.organizationName}. Type: ${profile.organizationType}.`,
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
    "Weights change emphasis, never facts. Safety, governance, readiness and explicit evidence always take precedence.",
  ].join("\n");
}
