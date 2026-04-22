import type { SessionStrategy, WeeklyOperationalDecision } from "../../models";
import {
    getWeeklyExecutionEnvelope,
    validateSessionAgainstWeeklyAuthority,
} from "../weekly-session-authority";

const baseWeeklyDecision: WeeklyOperationalDecision = {
  sessionIndexInWeek: 2,
  sessionRole: "transferencia_jogo",
  quarterFocus: "Aplicacao em jogo",
  appliedRules: [],
  driftRisks: [],
  quarter: "Q3",
  closingType: "aplicacao",
};

const baseStrategy: SessionStrategy = {
  primarySkill: "passe",
  progressionDimension: "tomada_decisao",
  pedagogicalIntent: "game_reading",
  loadIntent: "moderado",
  drillFamilies: ["jogo_condicionado"],
  forbiddenDrillFamilies: [],
  oppositionLevel: "medium",
  timePressureLevel: "medium",
  gameTransferLevel: "medium",
};

describe("weekly session authority", () => {
  it("maps transfer role envelope with transfer-oriented progressions", () => {
    const envelope = getWeeklyExecutionEnvelope("transferencia_jogo");

    expect(envelope.allowedProgressions).toEqual(["tomada_decisao", "transferencia_jogo"]);
    expect(envelope.minimumGameTransferLevel).toBe("medium");
  });

  it("accepts transfer-oriented execution within transfer role", () => {
    const result = validateSessionAgainstWeeklyAuthority({
      weeklyDecision: baseWeeklyDecision,
      strategy: baseStrategy,
    });

    expect(result?.isWithinEnvelope).toBe(true);
    expect(result?.violations).toEqual([]);
  });

  it("rejects pure technical isolation under transfer role", () => {
    const result = validateSessionAgainstWeeklyAuthority({
      weeklyDecision: baseWeeklyDecision,
      strategy: {
        ...baseStrategy,
        progressionDimension: "precisao",
        pedagogicalIntent: "technical_adjustment",
        gameTransferLevel: "low",
        oppositionLevel: "low",
        timePressureLevel: "low",
        drillFamilies: ["bloco_tecnico"],
      },
    });

    expect(result?.isWithinEnvelope).toBe(false);
    expect(result?.violations).toContain("pure_technical_isolation_not_allowed");
  });

  it("caps load for retomada_consolidacao role", () => {
    const result = validateSessionAgainstWeeklyAuthority({
      weeklyDecision: {
        ...baseWeeklyDecision,
        sessionRole: "retomada_consolidacao",
      },
      strategy: {
        ...baseStrategy,
        progressionDimension: "consistencia",
        loadIntent: "alto",
      },
    });

    expect(result?.isWithinEnvelope).toBe(false);
    expect(result?.violations).toContain("load_above_weekly_role_maximum");
  });

  it("requires closure signal for sintese_fechamento role", () => {
    const result = validateSessionAgainstWeeklyAuthority({
      weeklyDecision: {
        ...baseWeeklyDecision,
        sessionRole: "sintese_fechamento",
      },
      strategy: {
        ...baseStrategy,
        progressionDimension: "transferencia_jogo",
        gameTransferLevel: "low",
      },
    });

    expect(result?.isWithinEnvelope).toBe(false);
    expect(result?.violations).toContain("missing_closure_signal");
  });

  it("returns null when decision or strategy is unavailable", () => {
    expect(
      validateSessionAgainstWeeklyAuthority({
        weeklyDecision: null,
        strategy: baseStrategy,
      })
    ).toBeNull();

    expect(
      validateSessionAgainstWeeklyAuthority({
        weeklyDecision: baseWeeklyDecision,
        strategy: null,
      })
    ).toBeNull();
  });
});
