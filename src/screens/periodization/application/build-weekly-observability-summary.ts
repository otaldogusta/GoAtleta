import type {
    PedagogicalDriftSignal,
    SessionOperationalDebug,
    SessionStrategy,
    WeekSessionRole,
    WeeklyObservabilitySummary,
    WeeklyOperationalStrategySnapshot,
    WeeklySessionCoherenceCheck,
} from "../../../core/models";
import type { PeriodizationWeekScheduleItem } from "./build-auto-plan-for-cycle-day";

const progressionRank: Record<SessionStrategy["progressionDimension"], number> = {
  consistencia: 0,
  precisao: 1,
  pressao_tempo: 2,
  oposicao: 3,
  tomada_decisao: 4,
  transferencia_jogo: 5,
};

const levelRank: Record<SessionStrategy["gameTransferLevel"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const detectEnvelopeViolation = (
  sessionRole: WeekSessionRole,
  strategy: SessionStrategy
): string | null => {
  const progression = progressionRank[strategy.progressionDimension] ?? 0;
  const transfer = levelRank[strategy.gameTransferLevel] ?? 0;
  const opposition = levelRank[strategy.oppositionLevel] ?? 0;
  const pressure = levelRank[strategy.timePressureLevel] ?? 0;

  if (sessionRole === "introducao_exploracao" || sessionRole === "retomada_consolidacao") {
    if (progression > progressionRank.precisao) {
      return "progression_out_of_intro_envelope";
    }
    if (strategy.loadIntent === "alto") {
      return "load_out_of_intro_envelope";
    }
    return null;
  }

  if (sessionRole === "consolidacao_orientada") {
    if (progression < progressionRank.precisao) {
      return "progression_below_consolidation_floor";
    }
    return null;
  }

  if (sessionRole === "pressao_decisao") {
    if (progression < progressionRank.pressao_tempo) {
      return "progression_below_pressure_floor";
    }
    if (opposition < levelRank.medium || pressure < levelRank.medium) {
      return "pressure_levels_below_week_role";
    }
    return null;
  }

  if (sessionRole === "transferencia_jogo") {
    if (progression < progressionRank.tomada_decisao) {
      return "progression_below_transfer_floor";
    }
    if (transfer < levelRank.medium) {
      return "transfer_level_below_week_role";
    }
    return null;
  }

  if (sessionRole === "sintese_fechamento") {
    if (progression < progressionRank.tomada_decisao) {
      return "progression_below_closing_floor";
    }
    if (transfer < levelRank.medium) {
      return "transfer_level_below_closing_floor";
    }
    if (strategy.loadIntent === "alto") {
      return "load_not_reduced_for_closing";
    }
  }

  return null;
};

const buildSessionCoherence = (params: {
  decisions: WeeklyOperationalStrategySnapshot["decisions"];
  weekSchedule: PeriodizationWeekScheduleItem[];
}) => {
  const coherence: WeeklySessionCoherenceCheck[] = [];
  const sessionDebug: SessionOperationalDebug[] = [];

  for (const decision of params.decisions) {
    const sessionItem = params.weekSchedule.find(
      (item) => item.sessionIndexInWeek === decision.sessionIndexInWeek
    );
    const finalStrategy = sessionItem?.autoPlan?.strategy ?? null;

    if (!finalStrategy) {
      coherence.push({
        sessionIndexInWeek: decision.sessionIndexInWeek,
        sessionRole: decision.sessionRole,
        envelopeRespected: false,
        reason: "missing_session_strategy",
      });
      sessionDebug.push({
        sessionIndex: decision.sessionIndexInWeek,
        sessionRole: decision.sessionRole,
        finalStrategy: null,
        rulesApplied: [...decision.appliedRules],
        envelopeRespected: false,
      });
      continue;
    }

    const reason = detectEnvelopeViolation(decision.sessionRole, finalStrategy);
    const envelopeRespected = !reason;

    coherence.push({
      sessionIndexInWeek: decision.sessionIndexInWeek,
      sessionRole: decision.sessionRole,
      envelopeRespected,
      reason: reason ?? undefined,
    });
    sessionDebug.push({
      sessionIndex: decision.sessionIndexInWeek,
      sessionRole: decision.sessionRole,
      finalStrategy,
      rulesApplied: [...decision.appliedRules],
      envelopeRespected,
    });
  }

  return { coherence, sessionDebug };
};

export const validateWeeklySessionCoherence = (params: {
  weeklySnapshot: WeeklyOperationalStrategySnapshot;
  weekSchedule: PeriodizationWeekScheduleItem[];
}): WeeklySessionCoherenceCheck[] =>
  buildSessionCoherence({
    decisions: params.weeklySnapshot.decisions,
    weekSchedule: params.weekSchedule,
  }).coherence;

export const detectPedagogicalDrift = (params: {
  weeklySnapshot: WeeklyOperationalStrategySnapshot;
  weekSchedule: PeriodizationWeekScheduleItem[];
  coherence: WeeklySessionCoherenceCheck[];
}): PedagogicalDriftSignal[] => {
  const driftSignals: PedagogicalDriftSignal[] = [];
  const scheduledStrategies = params.weekSchedule
    .filter((item): item is PeriodizationWeekScheduleItem & { autoPlan: NonNullable<PeriodizationWeekScheduleItem["autoPlan"]> } =>
      Boolean(item.autoPlan)
    )
    .map((item) => item.autoPlan.strategy);

  const hasMisalignment = params.coherence.some((item) => !item.envelopeRespected);
  if (hasMisalignment) {
    driftSignals.push({
      detected: true,
      severity: "high",
      reason: "At least one session escaped the weekly role envelope.",
      code: "weekly_session_misalignment",
    });
  }

  if (params.weeklySnapshot.diagnostics.closingType === "fechamento") {
    const closingDecision = params.weeklySnapshot.decisions.find(
      (decision) => decision.sessionRole === "sintese_fechamento"
    );
    const closingCoherence = params.coherence.find(
      (item) => item.sessionRole === "sintese_fechamento"
    );
    if (!closingDecision || !closingCoherence?.envelopeRespected) {
      driftSignals.push({
        detected: true,
        severity: "high",
        reason: "Quarter closing is present in metadata but not sustained in session execution.",
        code: "quarter_week_misalignment",
      });
    }
  }

  if (params.weeklySnapshot.weekRulesApplied.includes("load_contrast_preserved") && scheduledStrategies.length >= 2) {
    const uniqueLoad = new Set(scheduledStrategies.map((strategy) => strategy.loadIntent));
    if (uniqueLoad.size <= 1) {
      driftSignals.push({
        detected: true,
        severity: "medium",
        reason: "Weekly contrast was requested but daily load remained flat.",
        code: "load_flattening",
      });
    }
  }

  if (scheduledStrategies.length >= 3) {
    const firstDrills = uniqueStrings(
      scheduledStrategies.map((strategy) => strategy.drillFamilies[0])
    );
    if (firstDrills.length <= 1) {
      driftSignals.push({
        detected: true,
        severity: "medium",
        reason: "Session blocks repeated with low methodological variation.",
        code: "repetition_excess",
      });
    }
  }

  if (scheduledStrategies.length >= 3) {
    const uniqueProgressions = new Set(
      scheduledStrategies.map((strategy) => strategy.progressionDimension)
    );
    if (uniqueProgressions.size <= 1) {
      driftSignals.push({
        detected: true,
        severity: "medium",
        reason: "Progression remained static across the week.",
        code: "progression_stagnation",
      });
    }
  }

  return driftSignals;
};

export const buildWeeklyObservabilitySummary = (params: {
  weeklySnapshot: WeeklyOperationalStrategySnapshot | null;
  weekSchedule: PeriodizationWeekScheduleItem[];
}): WeeklyObservabilitySummary | null => {
  const snapshot = params.weeklySnapshot;
  if (!snapshot) return null;

  const { coherence, sessionDebug } = buildSessionCoherence({
    decisions: snapshot.decisions,
    weekSchedule: params.weekSchedule,
  });
  const driftSignals = detectPedagogicalDrift({
    weeklySnapshot: snapshot,
    weekSchedule: params.weekSchedule,
    coherence,
  });

  return {
    quarterFocus: snapshot.quarterFocus,
    quarter: snapshot.diagnostics.quarter,
    closingType: snapshot.diagnostics.closingType,
    weekRulesApplied: [...snapshot.weekRulesApplied],
    driftRisks: [...snapshot.diagnostics.driftRisks],
    sessionRoleSummary: snapshot.sessionRoleSummary,
    sessionSummaries: snapshot.decisions.map((decision) => ({
      sessionIndexInWeek: decision.sessionIndexInWeek,
      sessionRole: decision.sessionRole,
    })),
    coherence,
    driftSignals,
    sessionDebug,
  };
};
