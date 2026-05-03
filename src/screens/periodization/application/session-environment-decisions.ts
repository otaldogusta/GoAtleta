import type {
  SessionEnvironment,
  SessionPrimaryComponent,
  WeekSessionRole,
  WeeklyOperationalDecision,
  WeeklyOperationalStrategySnapshot,
} from "../../../core/models";

export const SESSION_ENVIRONMENT_OPTIONS: Array<{
  value: SessionEnvironment;
  label: string;
}> = [
  { value: "quadra", label: "Quadra" },
  { value: "academia", label: "Academia" },
  { value: "mista", label: "Mista" },
];

export type SessionEnvironmentDecisions = Record<number, SessionEnvironment>;

const EXPLICIT_ENVIRONMENT_RULE = "explicit_session_environment";

export const normalizeSessionEnvironment = (value: unknown): SessionEnvironment => {
  if (value === "academia" || value === "mista" || value === "preventiva") return value;
  return "quadra";
};

export const formatSessionEnvironmentLabel = (value: SessionEnvironment): string => {
  switch (value) {
    case "academia":
      return "Academia";
    case "mista":
      return "Mista";
    case "preventiva":
      return "Preventiva";
    case "quadra":
    default:
      return "Quadra";
  }
};

export const sessionEnvironmentToPrimaryComponent = (
  value: SessionEnvironment
): SessionPrimaryComponent => {
  switch (value) {
    case "academia":
      return "resistido";
    case "mista":
      return "misto_transferencia";
    case "preventiva":
      return "preventivo";
    case "quadra":
    default:
      return "tecnico_tatico";
  }
};

const fallbackSessionRole = (sessionIndex: number, sessionCount: number): WeekSessionRole => {
  if (sessionIndex <= 1) return "introducao_exploracao";
  if (sessionIndex >= sessionCount) return "transferencia_jogo";
  return "consolidacao_orientada";
};

const safeParseSnapshotContainer = (rawJson: string | null | undefined) => {
  const raw = String(rawJson ?? "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Keep the weekly editor resilient if legacy JSON was malformed.
  }
  return {};
};

const normalizeStrategy = (value: unknown): WeeklyOperationalStrategySnapshot => {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<WeeklyOperationalStrategySnapshot>)
      : {};

  return {
    decisions: Array.isArray(candidate.decisions)
      ? (candidate.decisions as WeeklyOperationalDecision[])
      : [],
    quarterFocus: String(candidate.quarterFocus ?? ""),
    sessionRoleSummary: String(candidate.sessionRoleSummary ?? ""),
    weekIntentSummary: String(candidate.weekIntentSummary ?? ""),
    weekRulesApplied: Array.isArray(candidate.weekRulesApplied)
      ? candidate.weekRulesApplied.map(String)
      : [],
    diagnostics: {
      quarter: candidate.diagnostics?.quarter ?? "unknown",
      closingType: candidate.diagnostics?.closingType ?? "unknown",
      driftRisks: Array.isArray(candidate.diagnostics?.driftRisks)
        ? candidate.diagnostics.driftRisks.map(String)
        : [],
    },
  };
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

export const getSessionEnvironmentDecisions = (
  rawJson: string | null | undefined,
  sessionCount: number
): SessionEnvironmentDecisions => {
  const container = safeParseSnapshotContainer(rawJson);
  const strategy = normalizeStrategy(container.weeklyOperationalStrategy);
  const decisions: SessionEnvironmentDecisions = {};

  for (let index = 1; index <= Math.max(1, sessionCount); index += 1) {
    const existing = strategy.decisions.find((item) => item.sessionIndexInWeek === index);
    decisions[index] = normalizeSessionEnvironment(existing?.sessionEnvironment);
  }

  return decisions;
};

export const applySessionEnvironmentDecisions = ({
  rawJson,
  sessionCount,
  decisions,
}: {
  rawJson: string | null | undefined;
  sessionCount: number;
  decisions: SessionEnvironmentDecisions;
}): string => {
  const normalizedCount = Math.max(1, sessionCount);
  const container = safeParseSnapshotContainer(rawJson);
  const strategy = normalizeStrategy(container.weeklyOperationalStrategy);
  const byIndex = new Map<number, WeeklyOperationalDecision>();

  strategy.decisions.forEach((decision) => {
    byIndex.set(decision.sessionIndexInWeek, decision);
  });

  const nextDecisions = Array.from({ length: normalizedCount }, (_, itemIndex) => {
    const sessionIndexInWeek = itemIndex + 1;
    const existing = byIndex.get(sessionIndexInWeek);
    const sessionEnvironment = normalizeSessionEnvironment(
      decisions[sessionIndexInWeek] ?? existing?.sessionEnvironment
    );

    return {
      ...existing,
      sessionIndexInWeek,
      sessionRole:
        existing?.sessionRole ?? fallbackSessionRole(sessionIndexInWeek, normalizedCount),
      quarterFocus: existing?.quarterFocus ?? strategy.quarterFocus,
      appliedRules: uniqueStrings([
        ...(existing?.appliedRules ?? []),
        EXPLICIT_ENVIRONMENT_RULE,
      ]),
      driftRisks: existing?.driftRisks ?? [],
      quarter: existing?.quarter ?? strategy.diagnostics.quarter,
      closingType: existing?.closingType ?? strategy.diagnostics.closingType,
      sessionEnvironment,
      sessionPrimaryComponent: sessionEnvironmentToPrimaryComponent(sessionEnvironment),
    } satisfies WeeklyOperationalDecision;
  });

  return JSON.stringify({
    ...container,
    weeklyOperationalStrategy: {
      ...strategy,
      decisions: nextDecisions,
      weekRulesApplied: uniqueStrings([
        ...strategy.weekRulesApplied,
        EXPLICIT_ENVIRONMENT_RULE,
      ]),
    },
  });
};
