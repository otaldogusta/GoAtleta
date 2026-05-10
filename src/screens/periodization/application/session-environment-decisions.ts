import type {
  ResistanceSportContext,
  ResistanceTrainingContext,
  ResistanceTrainingContextConfidence,
  ResistanceTrainingContextSource,
  SessionEnvironment,
  SessionPrimaryComponent,
  WeekSessionRole,
  WeeklyOperationalDecision,
  WeeklyOperationalStrategySnapshot,
} from "../../../core/models";
import {
  formatResistanceTrainingContextLabel,
  resolveResistanceSportContext,
} from "../../../core/resistance/training-context";

export const SESSION_ENVIRONMENT_OPTIONS: Array<{
  value: SessionEnvironment;
  label: string;
}> = [
  { value: "quadra", label: "Quadra" },
  { value: "academia", label: "Academia" },
  { value: "mista", label: "Mista" },
];

export type SessionEnvironmentDecisions = Record<number, SessionEnvironment>;
export type SessionTrainingContextSelection = "automatic" | ResistanceTrainingContext;
export type SessionTrainingContextDecisions = Record<number, SessionTrainingContextSelection>;

const EXPLICIT_ENVIRONMENT_RULE = "explicit_session_environment";
const EXPLICIT_TRAINING_CONTEXT_RULE = "explicit_training_context";

export const SESSION_TRAINING_CONTEXT_OPTIONS: Array<{
  value: SessionTrainingContextSelection;
  label: string;
}> = [
  { value: "automatic", label: "Automático" },
  { value: "general_fitness", label: "Condicionamento geral" },
  { value: "health", label: "Saúde e movimento" },
  { value: "strength", label: "Força" },
  { value: "hypertrophy", label: "Hipertrofia" },
  { value: "rehabilitation_light", label: "Prevenção" },
  { value: "volleyball", label: "Vôlei" },
  { value: "other_sport", label: "Outro esporte" },
];

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

export const formatSessionTrainingContextLabel = (
  value: SessionTrainingContextSelection
) => {
  if (value === "automatic") return "Automático";
  return formatResistanceTrainingContextLabel(value);
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

const normalizeTrainingContextSelection = (
  decision?: WeeklyOperationalDecision | null
): SessionTrainingContextSelection => {
  if (!decision?.trainingContext || decision.contextSource !== "weekly_strategy") {
    return "automatic";
  }
  return decision.trainingContext;
};

export const getSessionTrainingContextDecisions = (
  rawJson: string | null | undefined,
  sessionCount: number
): SessionTrainingContextDecisions => {
  const container = safeParseSnapshotContainer(rawJson);
  const strategy = normalizeStrategy(container.weeklyOperationalStrategy);
  const decisions: SessionTrainingContextDecisions = {};

  for (let index = 1; index <= Math.max(1, sessionCount); index += 1) {
    const existing = strategy.decisions.find((item) => item.sessionIndexInWeek === index);
    decisions[index] = normalizeTrainingContextSelection(existing);
  }

  return decisions;
};

const buildExplicitTrainingContextFields = (trainingContext: ResistanceTrainingContext) => {
  const sportContext = resolveResistanceSportContext(trainingContext);
  const contextSource: ResistanceTrainingContextSource = "weekly_strategy";
  const contextConfidence: ResistanceTrainingContextConfidence = "high";
  const contextReason = `A periodização semanal definiu ${formatResistanceTrainingContextLabel(trainingContext).toLowerCase()} como foco do treino.`;

  return {
    trainingContext,
    sportContext: sportContext as ResistanceSportContext | undefined,
    contextSource,
    contextConfidence,
    contextReason,
  };
};

export const applySessionEnvironmentDecisions = ({
  rawJson,
  sessionCount,
  decisions,
  trainingContexts,
}: {
  rawJson: string | null | undefined;
  sessionCount: number;
  decisions: SessionEnvironmentDecisions;
  trainingContexts?: SessionTrainingContextDecisions;
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
    const trainingContextSelection = trainingContexts?.[sessionIndexInWeek] ?? "automatic";
    const explicitTrainingContext =
      trainingContextSelection !== "automatic"
        ? buildExplicitTrainingContextFields(trainingContextSelection)
        : null;

    return {
      ...existing,
      sessionIndexInWeek,
      sessionRole:
        existing?.sessionRole ?? fallbackSessionRole(sessionIndexInWeek, normalizedCount),
      quarterFocus: existing?.quarterFocus ?? strategy.quarterFocus,
      appliedRules: uniqueStrings([
        ...(existing?.appliedRules ?? []).filter((rule) => rule !== EXPLICIT_TRAINING_CONTEXT_RULE),
        EXPLICIT_ENVIRONMENT_RULE,
        ...(explicitTrainingContext ? [EXPLICIT_TRAINING_CONTEXT_RULE] : []),
      ]),
      driftRisks: existing?.driftRisks ?? [],
      quarter: existing?.quarter ?? strategy.diagnostics.quarter,
      closingType: existing?.closingType ?? strategy.diagnostics.closingType,
      sessionEnvironment,
      sessionPrimaryComponent: sessionEnvironmentToPrimaryComponent(sessionEnvironment),
      trainingContext: explicitTrainingContext?.trainingContext,
      sportContext: explicitTrainingContext?.sportContext,
      contextSource: explicitTrainingContext?.contextSource,
      contextConfidence: explicitTrainingContext?.contextConfidence,
      contextReason: explicitTrainingContext?.contextReason,
    } satisfies WeeklyOperationalDecision;
  });

  return JSON.stringify({
    ...container,
    weeklyOperationalStrategy: {
      ...strategy,
      decisions: nextDecisions,
      weekRulesApplied: uniqueStrings([
        ...strategy.weekRulesApplied.filter((rule) => rule !== EXPLICIT_TRAINING_CONTEXT_RULE),
        EXPLICIT_ENVIRONMENT_RULE,
        ...(Object.values(trainingContexts ?? {}).some((value) => value !== "automatic")
          ? [EXPLICIT_TRAINING_CONTEXT_RULE]
          : []),
      ]),
    },
  });
};
