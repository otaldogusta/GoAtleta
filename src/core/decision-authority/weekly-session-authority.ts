import type {
    ProgressionDimension,
    SessionStrategy,
    StrategyLevel,
    WeekSessionRole,
    WeeklyAuthorityViolationCode,
    WeeklyLoadIntent,
    WeeklyOperationalDecision,
} from "../models";

export type WeeklyExecutionEnvelope = {
  allowedProgressions: ProgressionDimension[];
  minimumGameTransferLevel?: StrategyLevel;
  maximumLoadIntent?: WeeklyLoadIntent;
  requiresClosureSignal?: boolean;
  forbidsPureTechnicalIsolation?: boolean;
};

export type WeeklySessionAuthorityResult = {
  sessionRole: WeekSessionRole;
  envelope: WeeklyExecutionEnvelope;
  isWithinEnvelope: boolean;
  violations: WeeklyAuthorityViolationCode[];
};

const WEEKLY_ROLE_ENVELOPES: Record<WeekSessionRole, WeeklyExecutionEnvelope> = {
  introducao_exploracao: {
    allowedProgressions: ["consistencia", "precisao"],
    minimumGameTransferLevel: "low",
    forbidsPureTechnicalIsolation: false,
  },
  retomada_consolidacao: {
    allowedProgressions: ["consistencia", "precisao"],
    maximumLoadIntent: "moderado",
    minimumGameTransferLevel: "low",
    forbidsPureTechnicalIsolation: false,
  },
  consolidacao_orientada: {
    allowedProgressions: ["consistencia", "precisao", "pressao_tempo"],
    maximumLoadIntent: "moderado",
    minimumGameTransferLevel: "low",
  },
  pressao_decisao: {
    allowedProgressions: ["pressao_tempo", "tomada_decisao"],
    minimumGameTransferLevel: "medium",
    forbidsPureTechnicalIsolation: true,
  },
  transferencia_jogo: {
    allowedProgressions: ["tomada_decisao", "transferencia_jogo"],
    minimumGameTransferLevel: "medium",
    forbidsPureTechnicalIsolation: true,
  },
  sintese_fechamento: {
    allowedProgressions: ["tomada_decisao", "transferencia_jogo"],
    minimumGameTransferLevel: "medium",
    maximumLoadIntent: "moderado",
    requiresClosureSignal: true,
    forbidsPureTechnicalIsolation: true,
  },
};

const STRATEGY_LEVEL_RANK: Record<StrategyLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const LOAD_INTENT_RANK: Record<WeeklyLoadIntent, number> = {
  baixo: 1,
  moderado: 2,
  alto: 3,
};

export function getWeeklyExecutionEnvelope(role: WeekSessionRole): WeeklyExecutionEnvelope {
  return WEEKLY_ROLE_ENVELOPES[role];
}

export function validateSessionAgainstWeeklyAuthority(params: {
  weeklyDecision: WeeklyOperationalDecision | null | undefined;
  strategy: SessionStrategy | null | undefined;
}): WeeklySessionAuthorityResult | null {
  const { weeklyDecision, strategy } = params;

  if (!weeklyDecision || !strategy) {
    return null;
  }

  const envelope = getWeeklyExecutionEnvelope(weeklyDecision.sessionRole);
  const violations: WeeklyAuthorityViolationCode[] = [];

  if (!envelope.allowedProgressions.includes(strategy.progressionDimension)) {
    violations.push("progression_outside_weekly_role");
  }

  if (
    envelope.minimumGameTransferLevel &&
    compareStrategyLevels(strategy.gameTransferLevel, envelope.minimumGameTransferLevel) < 0
  ) {
    violations.push("game_transfer_below_weekly_role_minimum");
  }

  if (
    envelope.maximumLoadIntent &&
    compareLoadIntent(strategy.loadIntent, envelope.maximumLoadIntent) > 0
  ) {
    violations.push("load_above_weekly_role_maximum");
  }

  if (
    envelope.forbidsPureTechnicalIsolation &&
    strategy.progressionDimension === "precisao" &&
    strategy.gameTransferLevel === "low"
  ) {
    violations.push("pure_technical_isolation_not_allowed");
  }

  if (
    envelope.requiresClosureSignal &&
    compareStrategyLevels(strategy.gameTransferLevel, "medium") < 0
  ) {
    violations.push("missing_closure_signal");
  }

  return {
    sessionRole: weeklyDecision.sessionRole,
    envelope,
    isWithinEnvelope: violations.length === 0,
    violations,
  };
}

function compareStrategyLevels(a: StrategyLevel, b: StrategyLevel): number {
  return STRATEGY_LEVEL_RANK[a] - STRATEGY_LEVEL_RANK[b];
}

function compareLoadIntent(a: WeeklyLoadIntent, b: WeeklyLoadIntent): number {
  return LOAD_INTENT_RANK[a] - LOAD_INTENT_RANK[b];
}
