import {
  applySessionEnvironmentDecisions,
  getSessionEnvironmentDecisions,
  getSessionTrainingContextDecisions,
  sessionEnvironmentToPrimaryComponent,
} from "../application/session-environment-decisions";

describe("session-environment-decisions", () => {
  it("falls back ambiguous or legacy weekly snapshots to quadra", () => {
    const result = getSessionEnvironmentDecisions("", 2);

    expect(result).toEqual({
      1: "quadra",
      2: "quadra",
    });
  });

  it("persists explicit session environments in the weekly operational strategy", () => {
    const rawJson = JSON.stringify({
      weeklyOperationalStrategy: {
        decisions: [
          {
            sessionIndexInWeek: 1,
            sessionRole: "retomada_consolidacao",
            quarterFocus: "Consolidar primeira bola.",
            appliedRules: ["weekly_role_template"],
            driftRisks: [],
            quarter: "Q2",
            closingType: "consolidacao",
          },
        ],
        quarterFocus: "Consolidar primeira bola.",
        sessionRoleSummary: "S1 retomada",
        weekIntentSummary: "Semana de consolidacao.",
        weekRulesApplied: ["weekly_role_template"],
        diagnostics: {
          quarter: "Q2",
          closingType: "consolidacao",
          driftRisks: [],
        },
      },
    });

    const nextJson = applySessionEnvironmentDecisions({
      rawJson,
      sessionCount: 2,
      decisions: {
        1: "quadra",
        2: "academia",
      },
    });
    const parsed = JSON.parse(nextJson);

    expect(parsed.weeklyOperationalStrategy.decisions[0].sessionEnvironment).toBe("quadra");
    expect(parsed.weeklyOperationalStrategy.decisions[0].sessionPrimaryComponent).toBe(
      "tecnico_tatico"
    );
    expect(parsed.weeklyOperationalStrategy.decisions[1].sessionEnvironment).toBe("academia");
    expect(parsed.weeklyOperationalStrategy.decisions[1].sessionPrimaryComponent).toBe(
      "resistido"
    );
    expect(parsed.weeklyOperationalStrategy.weekRulesApplied).toContain(
      "explicit_session_environment"
    );
  });

  it("persists explicit weekly training context and reopens with the same focus", () => {
    const rawJson = JSON.stringify({
      weeklyOperationalStrategy: {
        decisions: [
          {
            sessionIndexInWeek: 1,
            sessionRole: "retomada_consolidacao",
            quarterFocus: "Consolidar primeira bola.",
            appliedRules: ["weekly_role_template"],
            driftRisks: [],
            quarter: "Q2",
            closingType: "consolidacao",
            trainingContext: "volleyball",
            sportContext: "volleyball",
            contextSource: "class_modality",
          },
        ],
        quarterFocus: "Consolidar primeira bola.",
        sessionRoleSummary: "S1 retomada",
        weekIntentSummary: "Semana de consolidacao.",
        weekRulesApplied: ["weekly_role_template"],
        diagnostics: {
          quarter: "Q2",
          closingType: "consolidacao",
          driftRisks: [],
        },
      },
    });

    const nextJson = applySessionEnvironmentDecisions({
      rawJson,
      sessionCount: 2,
      decisions: {
        1: "academia",
        2: "mista",
      },
      trainingContexts: {
        1: "general_fitness",
        2: "volleyball",
      },
    });
    const parsed = JSON.parse(nextJson);

    expect(parsed.weeklyOperationalStrategy.decisions[0].trainingContext).toBe(
      "general_fitness"
    );
    expect(parsed.weeklyOperationalStrategy.decisions[0].contextSource).toBe(
      "weekly_strategy"
    );
    expect(parsed.weeklyOperationalStrategy.decisions[1].trainingContext).toBe(
      "volleyball"
    );
    expect(parsed.weeklyOperationalStrategy.decisions[1].sportContext).toBe(
      "volleyball"
    );
    expect(getSessionTrainingContextDecisions(nextJson, 2)).toEqual({
      1: "general_fitness",
      2: "volleyball",
    });
  });

  it("does not persist a false weekly override when focus stays automatic", () => {
    const rawJson = JSON.stringify({
      weeklyOperationalStrategy: {
        decisions: [
          {
            sessionIndexInWeek: 1,
            sessionRole: "retomada_consolidacao",
            quarterFocus: "Consolidar primeira bola.",
            appliedRules: ["weekly_role_template", "explicit_training_context"],
            driftRisks: [],
            quarter: "Q2",
            closingType: "consolidacao",
            trainingContext: "volleyball",
            sportContext: "volleyball",
            contextSource: "weekly_strategy",
            contextConfidence: "high",
            contextReason: "Escolha manual antiga.",
          },
        ],
        quarterFocus: "Consolidar primeira bola.",
        sessionRoleSummary: "S1 retomada",
        weekIntentSummary: "Semana de consolidacao.",
        weekRulesApplied: ["weekly_role_template", "explicit_training_context"],
        diagnostics: {
          quarter: "Q2",
          closingType: "consolidacao",
          driftRisks: [],
        },
      },
    });

    const nextJson = applySessionEnvironmentDecisions({
      rawJson,
      sessionCount: 1,
      decisions: {
        1: "academia",
      },
      trainingContexts: {
        1: "automatic",
      },
    });
    const parsed = JSON.parse(nextJson);

    expect(parsed.weeklyOperationalStrategy.decisions[0].trainingContext).toBeUndefined();
    expect(parsed.weeklyOperationalStrategy.decisions[0].contextSource).toBeUndefined();
    expect(parsed.weeklyOperationalStrategy.weekRulesApplied).not.toContain(
      "explicit_training_context"
    );
    expect(getSessionTrainingContextDecisions(nextJson, 1)).toEqual({
      1: "automatic",
    });
  });

  it("maps mista to a mixed transfer component", () => {
    expect(sessionEnvironmentToPrimaryComponent("mista")).toBe("misto_transferencia");
  });
});
