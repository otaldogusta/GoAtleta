import {
  applySessionEnvironmentDecisions,
  getSessionEnvironmentDecisions,
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

  it("maps mista to a mixed transfer component", () => {
    expect(sessionEnvironmentToPrimaryComponent("mista")).toBe("misto_transferencia");
  });
});
