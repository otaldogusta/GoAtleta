import {
  parseSessionPlanningContext,
  SESSION_PLANNING_CONTEXT_SCHEMA_VERSION,
  type SessionPlanningContext,
} from "../session-planning-context";
import type { AppliedPedagogicalReference } from "../document-intelligence/types";

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

const readOnlyActionContract = {
  mode: "read_only" as const,
  allowedActions: ["answer", "explain", "compare", "propose"] as const,
  forbiddenActions: [
    "apply",
    "persist",
    "mutate_plan",
    "regenerate_pdf",
    "create_global_memory",
  ] as const,
  requiresExplicitConfirmation: true as const,
  canWrite: false as const,
};

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

  it("preserves canonical document support and discards incomplete entries", () => {
    const reference: AppliedPedagogicalReference = {
      id: "reference-1",
      sourceDocumentId: "document-1",
      sourceRevisionId: "revision-1",
      contentHash: "hash-1",
      sourceScope: "workspace_academic",
      title: "Gestão e Organização do Trabalho Pedagógico",
      origin: "Faculdade",
      discipline: "Gestão do Trabalho Pedagógico",
      materialType: "university_handout",
      evidenceLevel: "institutional_academic_material",
      sourceLocation: "Unidade 4",
      excerpt: "O planejamento deve relacionar intenção, ação e avaliação.",
      influence: "A aula explicita critérios observáveis de sucesso.",
      appliedAt: "2026-06-12T10:00:00.000Z",
    };
    const payload = {
      ...currentContext(),
      documentSupport: {
        status: "available",
        references: [reference, { id: "incomplete-reference" }],
        warnings: [],
        retrievalMode: "contextual",
        actionDate: "2026-06-13",
        actionContract: readOnlyActionContract,
      },
    };

    const parsed = parseSessionPlanningContext(payload);

    expect(parsed.status).toBe("current");
    expect(parsed.context?.documentSupport).toEqual({
      status: "available",
      references: [reference],
      warnings: [],
      retrievalMode: "contextual",
      actionDate: "2026-06-13",
      actionContract: readOnlyActionContract,
    });
    expect(parsed.context?.academicSupport).toBeUndefined();
  });

  it("reads legacy academicSupport snapshots into canonical documentSupport", () => {
    const reference: AppliedPedagogicalReference = {
      id: "legacy-reference-1",
      sourceDocumentId: "legacy-document-1",
      sourceScope: "user_academic",
      title: "Prática de Ensino",
      origin: "Faculdade",
      materialType: "university_handout",
      evidenceLevel: "institutional_academic_material",
      excerpt: "O jogo organiza experiências de aprendizagem.",
      influence: "A aula preservou uma situação lúdica.",
    };
    const payload = {
      ...currentContext(),
      academicSupport: {
        status: "available",
        references: [reference],
        warnings: ["Snapshot anterior à camada unificada."],
        retrievalMode: "semantic",
      },
    };

    const parsed = parseSessionPlanningContext(payload);

    expect(parsed.status).toBe("current");
    expect(parsed.context?.documentSupport).toEqual({
      status: "available",
      references: [reference],
      warnings: ["Snapshot anterior à camada unificada."],
      retrievalMode: "semantic",
    });
    expect(parsed.context?.academicSupport).toBeUndefined();
  });
});
