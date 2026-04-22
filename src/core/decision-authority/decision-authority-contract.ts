export type DecisionAuthorityLayer =
  | "quarter"
  | "week"
  | "session"
  | "guard"
  | "qa"
  | "recommendation"
  | "teacher";

export type DecisionAuthorityPower =
  | "guides_direction"
  | "defines_intention"
  | "defines_execution"
  | "enforces_limits"
  | "observes_only"
  | "suggests_only"
  | "final_decision";

export type DecisionAuthorityContract = {
  quarter: "guides_direction";
  week: "defines_intention";
  session: "defines_execution";
  guard: "enforces_limits";
  qa: "observes_only";
  recommendation: "suggests_only";
  teacher: "final_decision";
};

export const DECISION_AUTHORITY_CONTRACT: DecisionAuthorityContract = {
  quarter: "guides_direction",
  week: "defines_intention",
  session: "defines_execution",
  guard: "enforces_limits",
  qa: "observes_only",
  recommendation: "suggests_only",
  teacher: "final_decision",
};

export const DECISION_AUTHORITY_CANONICAL_CHAIN = [
  "Trimestre orienta direcao.",
  "Semana define intencao.",
  "Sessao define execucao.",
  "Guards impoem limites.",
  "QA observa.",
  "Recommendation sugere.",
  "Professor decide.",
] as const;

export function getDecisionAuthorityPower(
  layer: DecisionAuthorityLayer
): DecisionAuthorityPower {
  return DECISION_AUTHORITY_CONTRACT[layer];
}

export function isObservationalLayer(layer: DecisionAuthorityLayer): boolean {
  return layer === "qa";
}

export function isSuggestionLayer(layer: DecisionAuthorityLayer): boolean {
  return layer === "recommendation";
}

export function isDirectiveLayer(layer: DecisionAuthorityLayer): boolean {
  return layer === "quarter" || layer === "week" || layer === "session" || layer === "guard";
}
