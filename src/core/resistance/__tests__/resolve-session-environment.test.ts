import type { TeamTrainingContext } from "../../models";
import {
    buildWeeklyIntegratedContext,
    resolveSessionEnvironment,
} from "../resolve-session-environment";

const ctxQuadra: TeamTrainingContext = {
  hasGymAccess: false,
  integratedTrainingModel: "quadra_apenas",
  resistanceTrainingProfile: "iniciante",
};

const ctxComplementar: TeamTrainingContext = {
  hasGymAccess: true,
  integratedTrainingModel: "academia_complementar",
  resistanceTrainingProfile: "iniciante",
};

const ctxIntegrada: TeamTrainingContext = {
  hasGymAccess: true,
  integratedTrainingModel: "academia_integrada",
  resistanceTrainingProfile: "intermediario",
};

const ctxPrioritaria: TeamTrainingContext = {
  hasGymAccess: true,
  integratedTrainingModel: "academia_prioritaria",
  resistanceTrainingProfile: "avancado",
};

describe("resolveSessionEnvironment", () => {
  it("always returns quadra for teams without gym access", () => {
    for (let i = 0; i < 4; i++) {
      expect(
        resolveSessionEnvironment({ teamContext: ctxQuadra, weeklySessions: 3, sessionIndexInWeek: i })
      ).toBe("quadra");
    }
  });

  it("academia_complementar: only session index 1 is academia (3 sessions/week)", () => {
    expect(resolveSessionEnvironment({ teamContext: ctxComplementar, weeklySessions: 3, sessionIndexInWeek: 0 })).toBe("quadra");
    expect(resolveSessionEnvironment({ teamContext: ctxComplementar, weeklySessions: 3, sessionIndexInWeek: 1 })).toBe("academia");
    expect(resolveSessionEnvironment({ teamContext: ctxComplementar, weeklySessions: 3, sessionIndexInWeek: 2 })).toBe("quadra");
  });

  it("academia_integrada with 3 sessions: index 1 is academia", () => {
    expect(resolveSessionEnvironment({ teamContext: ctxIntegrada, weeklySessions: 3, sessionIndexInWeek: 0 })).toBe("quadra");
    expect(resolveSessionEnvironment({ teamContext: ctxIntegrada, weeklySessions: 3, sessionIndexInWeek: 1 })).toBe("academia");
    expect(resolveSessionEnvironment({ teamContext: ctxIntegrada, weeklySessions: 3, sessionIndexInWeek: 2 })).toBe("quadra");
  });

  it("academia_prioritaria with 4 sessions: middle 2 are academia", () => {
    expect(resolveSessionEnvironment({ teamContext: ctxPrioritaria, weeklySessions: 4, sessionIndexInWeek: 0 })).toBe("quadra");
    expect(resolveSessionEnvironment({ teamContext: ctxPrioritaria, weeklySessions: 4, sessionIndexInWeek: 1 })).toBe("academia");
    expect(resolveSessionEnvironment({ teamContext: ctxPrioritaria, weeklySessions: 4, sessionIndexInWeek: 2 })).toBe("academia");
    expect(resolveSessionEnvironment({ teamContext: ctxPrioritaria, weeklySessions: 4, sessionIndexInWeek: 3 })).toBe("quadra");
  });
});

describe("buildWeeklyIntegratedContext", () => {
  it("returns quadra_dominante with no gym sessions for quadra team", () => {
    const ctx = buildWeeklyIntegratedContext({ teamContext: ctxQuadra, weeklySessions: 3 });
    expect(ctx.gymSessionsCount).toBe(0);
    expect(ctx.courtSessionsCount).toBe(3);
    expect(ctx.courtGymRelationship).toBe("quadra_dominante");
    expect(ctx.interferenceRisk).toBe("baixo");
  });

  it("returns interference risk alto for potencia + many gym sessions", () => {
    const ctx = buildWeeklyIntegratedContext({
      teamContext: ctxPrioritaria,
      weeklySessions: 4,
      weeklyPhysicalEmphasis: "potencia_atletica",
    });
    expect(ctx.interferenceRisk).toBe("alto");
  });

  it("counts gym and court sessions correctly for academia_complementar (3/week)", () => {
    const ctx = buildWeeklyIntegratedContext({ teamContext: ctxComplementar, weeklySessions: 3 });
    expect(ctx.gymSessionsCount).toBe(1);
    expect(ctx.courtSessionsCount).toBe(2);
  });
});
