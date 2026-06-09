import type { TrainingPlan, TrainingPlanPedagogy } from "../../core/models";
import { saveTrainingPlan } from "../training";

const mockSupabasePost = jest.fn();

jest.mock("../client", () => ({
  getActiveOrganizationId: jest.fn(() => Promise.resolve("org_1")),
  isAuthError: jest.fn(() => false),
  isNetworkError: jest.fn(() => false),
  readCache: jest.fn(() => Promise.resolve(null)),
  supabaseDelete: jest.fn(),
  supabaseGet: jest.fn(() => Promise.resolve([])),
  supabasePatch: jest.fn(),
  supabasePost: (...args: unknown[]) => mockSupabasePost(...args),
  writeCache: jest.fn(),
}));

const buildDecisionTrace = (): NonNullable<TrainingPlanPedagogy["decisionTrace"]> => ({
  schemaVersion: 1,
  source: {
    classId: "class_1",
    sessionDate: "2026-06-20",
    classPlanId: "plan_1",
    classPlanWeekNumber: 4,
  },
  plannedContext: {
    ageBand: "07-09",
    classLevel: 1,
    planningPhase: "base",
    weekNumber: 4,
    sessionIndexInWeek: 1,
    loadIntent: "baixo",
  },
  decision: {
    primarySkill: "passe",
    progressionDimension: "consistencia",
    pedagogicalIntent: "technical_adjustment",
    phaseIntent: "exploracao_fundamentos",
  },
  influences: {
    periodization: { used: true, technicalFocus: "Passe" },
    classContext: {
      used: true,
      goal: "Passe",
      modality: "voleibol",
      materials: ["bolas", "cones"],
      constraints: [],
    },
    scouting: { used: false, confidence: "none", sampleSize: 0 },
    history: {
      used: false,
      historicalConfidence: "none",
      recentSkills: [],
      mustAvoidRepeating: [],
    },
    reportFeedback: { used: false, signals: [] },
  },
  safeguards: {
    repetitionAdjusted: false,
    overrideAdjusted: false,
    fallbackUsed: false,
    ageSanitizerFlags: [],
    envelopeDiagnostics: [],
  },
  teacherFacingSummary: "A aula prioriza passe porque o planejamento da semana indica Passe.",
});

const buildPlan = (): TrainingPlan => ({
  id: "plan_1",
  classId: "class_1",
  title: "Turma 07-09 · Passe",
  tags: ["modo:humanizado"],
  warmup: ["Pega-pega dos 3 contatos"],
  main: ["Passe em duplas para voltar jogável"],
  cooldown: ["Roda rápida de fechamento"],
  warmupTime: "10 min",
  mainTime: "45 min",
  cooldownTime: "5 min",
  applyDays: [],
  applyDate: "2026-06-20",
  createdAt: "2026-06-09T10:00:00.000Z",
  version: 1,
  status: "final",
  origin: "auto",
  inputHash: "hash_1",
  generatedAt: "2026-06-09T10:00:00.000Z",
  finalizedAt: "2026-06-09T10:00:00.000Z",
  pedagogy: {
    decisionTrace: buildDecisionTrace(),
    blocks: {
      warmup: {
        summary: "Aquecimento",
        activities: [{ name: "Pega-pega dos 3 contatos" }],
      },
      main: {
        summary: "Parte principal",
        activities: [{ name: "Passe em duplas para voltar jogável" }],
      },
      cooldown: {
        summary: "Volta à calma",
        activities: [{ name: "Roda rápida de fechamento" }],
      },
    },
  },
});

describe("training plan persistence", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockSupabasePost.mockResolvedValue([]);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("posts generated pedagogy with decision trace in the versioned payload", async () => {
    await saveTrainingPlan(buildPlan(), { organizationId: "org_1" });

    expect(mockSupabasePost).toHaveBeenCalledTimes(1);
    const [path, rows] = mockSupabasePost.mock.calls[0];
    expect(path).toBe("/training_plans");
    expect(rows[0].pedagogy.decisionTrace.schemaVersion).toBe(1);
    expect(rows[0].pedagogy.decisionTrace.source.sessionDate).toBe("2026-06-20");
  });

  it("keeps pedagogy with decision trace when falling back from missing versioning columns", async () => {
    mockSupabasePost
      .mockRejectedValueOnce(new Error("column training_plans.version does not exist"))
      .mockResolvedValueOnce([]);

    await saveTrainingPlan(buildPlan(), { organizationId: "org_1" });

    expect(mockSupabasePost).toHaveBeenCalledTimes(2);
    const [, fallbackRows] = mockSupabasePost.mock.calls[1];
    expect(fallbackRows[0]).not.toHaveProperty("version");
    expect(fallbackRows[0].pedagogy.decisionTrace.schemaVersion).toBe(1);
    expect(fallbackRows[0].pedagogy.decisionTrace.source.classId).toBe("class_1");
  });
});
