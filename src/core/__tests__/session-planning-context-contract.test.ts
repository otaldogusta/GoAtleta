import {
  parseSessionPlanningContext,
  SESSION_PLANNING_CONTEXT_SCHEMA_VERSION,
  type SessionPlanningContext,
} from "../session-planning-context";

const currentContext = (): SessionPlanningContext => ({
  schemaVersion: SESSION_PLANNING_CONTEXT_SCHEMA_VERSION,
  classId: "class-1",
  sessionDate: "2026-06-13",
  ageBand: "07-09",
  sport: "volleyball",
  skillFocus: "passe",
  progressionDimension: "consistencia",
  pedagogicalIntent: "technical_adjustment",
  loadIntent: "moderado",
  recentDifficulties: [],
  recentActivityFamilies: [],
  upcomingEvents: [],
  availableDuration: 60,
  materials: ["bolas"],
  classProfile: { level: 1, daysPerWeek: 2, size: 10, heterogeneity: "baixa" },
    constraints: [],
    readinessState: {
      classId: "class-1",
      plannedGameLevel: "L6_3x3_introdutorio",
      estimatedGameLevel: "L3_1x1_intencional",
      appliedCoreLevel: "L4_2x2_cooperativo",
      confidence: "medium",
      riskFlags: ["salto_de_complexidade"],
      recommendation: "consolidar",
      reason: ["Ponte curta."],
      teacherMessage: "Hoje use 2x2 cooperativo.",
    },
    adaptiveEnvelope: {
      periodizationTarget: "L6_3x3_introdutorio",
      appliedCoreLevel: "L4_2x2_cooperativo",
      diagnosticProbe: {
        title: "Comece por aqui",
        description: "Observe a turma.",
        decisionRule: "Avance quando estabilizar.",
      },
      planARegression: {
        level: "L3_1x1_intencional",
        intent: "1x1",
        suggestedConstraint: "Permita quique.",
      },
      planBCore: {
        level: "L4_2x2_cooperativo",
        intent: "2x2",
        suggestedConstraint: "Use duplas.",
      },
      planCProgression: {
        level: "L5_2x2_decisao",
        intent: "2x2 decisão",
        suggestedConstraint: "Zona combinada.",
      },
    },
    coachGuidance: {
      title: "Ponte 1x1 -> 2x2",
      doNow: ["Comece com 1x1 com quique e alvo."],
      avoidToday: ["Evite 3x3 livre no começo."],
      advanceIf: ["A maioria mantiver 3 trocas no 1x1."],
      simplifyIf: ["A bola cair no primeiro contato."],
    },
  });

describe("SessionPlanningContext contract", () => {
  it("accepts current schemaVersion contexts", () => {
    const parsed = parseSessionPlanningContext(currentContext());

    expect(parsed.status).toBe("current");
    expect(parsed.context?.schemaVersion).toBe(1);
    expect(parsed.context?.coachGuidance?.title).toBe("Ponte 1x1 -> 2x2");
    expect(parsed.context?.readinessState?.appliedCoreLevel).toBe("L4_2x2_cooperativo");
    expect(parsed.warnings).toEqual([]);
  });

  it("accepts legacy contexts with a warning and upgrades the version", () => {
    const legacy = currentContext() as Omit<SessionPlanningContext, "schemaVersion"> &
      Partial<Pick<SessionPlanningContext, "schemaVersion">>;
    delete legacy.schemaVersion;

    const parsed = parseSessionPlanningContext(legacy);

    expect(parsed.status).toBe("legacy");
    expect(parsed.context?.schemaVersion).toBe(1);
    expect(parsed.warnings[0]).toContain("legado");
  });

  it("rejects invalid payloads without throwing", () => {
    const parsed = parseSessionPlanningContext({ classId: "class-1" });

    expect(parsed.status).toBe("invalid");
    expect(parsed.context).toBeNull();
  });
});
