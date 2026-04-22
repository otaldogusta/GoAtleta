import { validateSessionAgainstWeeklyAuthority } from "../../../core/decision-authority";
import type {
    PedagogicalDriftSignal,
    SessionOperationalDebug,
    WeeklyAuthorityCheck,
    WeeklyAuthoritySummary,
    WeeklyAuthorityViolationCode,
    WeeklyObservabilitySummary,
    WeeklyOperationalStrategySnapshot,
    WeeklySessionCoherenceCheck,
    WeeklyStabilityAssessment,
} from "../../../core/models";
import type { PeriodizationWeekScheduleItem } from "./build-auto-plan-for-cycle-day";

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const getAuthorityViolationSeverity = (
  code: WeeklyAuthorityViolationCode
): PedagogicalDriftSignal["severity"] => {
  switch (code) {
    case "pure_technical_isolation_not_allowed":
    case "missing_closure_signal":
      return "high";
    case "progression_outside_weekly_role":
    case "game_transfer_below_weekly_role_minimum":
    case "load_above_weekly_role_maximum":
      return "medium";
    default:
      return "low";
  }
};

const getDriftSignalWeight = (severity: PedagogicalDriftSignal["severity"]): number => {
  switch (severity) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
    default:
      return 1;
  }
};

const getAuthorityImpactScore = (authority: WeeklyAuthoritySummary | undefined): number => {
  if (!authority || authority.totalChecks === 0) return 0;

  let score = 0;
  for (const check of authority.checks) {
    for (const violation of check.violations) {
      switch (violation) {
        case "pure_technical_isolation_not_allowed":
        case "missing_closure_signal":
          score += 3;
          break;
        case "progression_outside_weekly_role":
        case "game_transfer_below_weekly_role_minimum":
        case "load_above_weekly_role_maximum":
          score += 2;
          break;
        default:
          score += 1;
      }
    }
  }

  if (authority.passRate < 0.5) {
    score += 2;
  }

  return score;
};

const buildWeeklyStabilityAssessment = (params: {
  driftSignals: PedagogicalDriftSignal[];
  authority?: WeeklyAuthoritySummary;
}): WeeklyStabilityAssessment => {
  const driftScore = params.driftSignals.reduce(
    (sum, signal) => sum + getDriftSignalWeight(signal.severity),
    0
  );
  const authorityScore = getAuthorityImpactScore(params.authority);
  const totalScore = driftScore + authorityScore;

  const reasons = Array.from(
    new Set([
      ...params.driftSignals.map((signal) => signal.code),
      ...(params.authority?.checks.flatMap((check) => check.violations) ?? []),
    ])
  );

  if (totalScore >= 6) {
    return {
      severity: "high",
      status: "unstable",
      reasons,
    };
  }

  if (totalScore >= 3) {
    return {
      severity: "medium",
      status: "attention",
      reasons,
    };
  }

  return {
    severity: "low",
    status: "stable",
    reasons,
  };
};

const buildWeeklyAuthoritySummary = (params: {
  weeklySnapshot: WeeklyOperationalStrategySnapshot;
  weekSchedule: PeriodizationWeekScheduleItem[];
}): WeeklyAuthoritySummary => {
  const checks: WeeklyAuthorityCheck[] = params.weeklySnapshot.decisions.map((decision) => {
    const strategy =
      params.weekSchedule.find((item) => item.sessionIndexInWeek === decision.sessionIndexInWeek)
        ?.autoPlan?.strategy ?? null;

    const result = validateSessionAgainstWeeklyAuthority({
      weeklyDecision: decision,
      strategy,
    });

    if (!result) {
      return {
        sessionIndexInWeek: decision.sessionIndexInWeek,
        sessionRole: decision.sessionRole,
        isWithinEnvelope: false,
        violations: ["progression_outside_weekly_role"],
      };
    }

    return {
      sessionIndexInWeek: decision.sessionIndexInWeek,
      sessionRole: decision.sessionRole,
      isWithinEnvelope: result.isWithinEnvelope,
      violations: result.violations,
    };
  });

  const totalChecks = checks.length;
  const totalViolations = checks.reduce((sum, item) => sum + item.violations.length, 0);
  const passedChecks = checks.filter((item) => item.isWithinEnvelope).length;

  return {
    checks,
    passRate: totalChecks > 0 ? passedChecks / totalChecks : 1,
    hasViolations: totalViolations > 0,
    totalChecks,
    totalViolations,
  };
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

    const authorityResult = validateSessionAgainstWeeklyAuthority({
      weeklyDecision: decision,
      strategy: finalStrategy,
    });
    const envelopeRespected = authorityResult?.isWithinEnvelope ?? false;
    const reason = authorityResult?.violations[0];

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
  authority?: WeeklyAuthoritySummary | null;
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

  if (params.authority?.hasViolations) {
    const highestSeverity = params.authority.checks
      .flatMap((check) => check.violations)
      .map((code) => getAuthorityViolationSeverity(code))
      .reduce<PedagogicalDriftSignal["severity"]>((current, incoming) => {
        const rank = { low: 1, medium: 2, high: 3 };
        return rank[incoming] > rank[current] ? incoming : current;
      }, "low");

    driftSignals.push({
      detected: true,
      severity: highestSeverity,
      reason: "One or more sessions escaped the authority envelope defined by weekly role.",
      code: "weekly_authority_violation",
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
  const authority = buildWeeklyAuthoritySummary({
    weeklySnapshot: snapshot,
    weekSchedule: params.weekSchedule,
  });
  const driftSignals = detectPedagogicalDrift({
    weeklySnapshot: snapshot,
    weekSchedule: params.weekSchedule,
    coherence,
    authority,
  });
  const stability = buildWeeklyStabilityAssessment({
    driftSignals,
    authority,
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
    authority,
    stability,
    driftSignals,
    sessionDebug,
  };
};
