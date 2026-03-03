import type { RegulationClause } from "../api/regulation-rule-sets";
import { safeNumber } from "../utils/safe-number";

export type RegulationContext = {
  organizationId?: string | null;
  eventType?: string | null;
  eventSport?: string | null;
  unitId?: string | null;
};

type ClauseOverride = {
  match?: Record<string, unknown>;
  value?: unknown;
};

const normalizeText = (value: unknown) => String(value ?? "").trim().toLowerCase();

const overrideMatchesContext = (
  override: ClauseOverride,
  context: RegulationContext
) => {
  const match = override.match;
  if (!match || typeof match !== "object") return false;
  const entries = Object.entries(match);
  if (!entries.length) return false;

  return entries.every(([key, expected]) => {
    const contextValue =
      key === "organizationId"
        ? context.organizationId
        : key === "eventType"
          ? context.eventType
          : key === "eventSport"
            ? context.eventSport
            : key === "unitId"
              ? context.unitId
              : undefined;
    return normalizeText(contextValue) === normalizeText(expected);
  });
};

export const resolveClauseValue = (
  clause: RegulationClause,
  context: RegulationContext
) => {
  const overrides = Array.isArray(clause.overrides) ? clause.overrides : [];
  for (const item of overrides) {
    if (!item || typeof item !== "object") continue;
    const parsed = item as ClauseOverride;
    if (overrideMatchesContext(parsed, context)) {
      return parsed.value;
    }
  }
  return clause.baseValue;
};

export const resolveClauseMap = (
  clauses: RegulationClause[],
  context: RegulationContext
) => {
  const map = new Map<string, unknown>();
  for (const clause of clauses) {
    map.set(clause.clauseKey, resolveClauseValue(clause, context));
  }
  return map;
};

export const resolveBooleanClause = (
  clausesByKey: Map<string, unknown>,
  key: string,
  fallback: boolean
) => {
  if (!clausesByKey.has(key)) return fallback;
  const value = clausesByKey.get(key);
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(value);
  if (normalized === "true" || normalized === "1" || normalized === "sim") return true;
  if (normalized === "false" || normalized === "0" || normalized === "nao" || normalized === "não")
    return false;
  return fallback;
};

export const resolveNumberClause = (
  clausesByKey: Map<string, unknown>,
  key: string,
  fallback: number
) => {
  if (!clausesByKey.has(key)) return fallback;
  return safeNumber(clausesByKey.get(key), fallback);
};

export const resolveStringArrayClause = (
  clausesByKey: Map<string, unknown>,
  key: string
) => {
  const value = clausesByKey.get(key);
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter(Boolean);
};
