import type { AppliedPedagogicalReference } from "../../../../core/document-intelligence/types";
import type { ClassGroup, Student, TrainingPlanPedagogy } from "../../../../core/models";
import { buildPedagogicalPlan } from "../../../../core/pedagogical-planning";
import {
  SESSION_PLANNING_CONTEXT_SCHEMA_VERSION,
  type SessionPlanningContext,
} from "../../../../core/session-planning-context";
import { convertPedagogicalPackageToTrainingPlan } from "../convert-pedagogical-package-to-training-plan";

const buildClassGroup = (): ClassGroup => ({
  id: "class_1",
  name: "Turma 07-09",
  organizationId: "org_1",
  unit: "Centro",
  unitId: "unit_1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "07-09",
  gender: "misto",
  startTime: "09:00",
  endTime: "10:00",
  durationMinutes: 60,
  daysOfWeek: [2, 5],
  daysPerWeek: 2,
  goal: "Passe e manchete",
  equipment: "quadra",
  level: 1,
  mvLevel: "iniciante",
  cycleStartDate: "2026-03-02",
  cycleLengthWeeks: 52,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-03-01T10:00:00.000Z",
});

const buildStudent = (): Student => ({
  id: "student_1",
  name: "Ana",
  organizationId: "org_1",
  classId: "class_1",
  age: 8,
  phone: "",
  loginEmail: "",
  guardianName: "",
  guardianPhone: "",
  guardianRelation: "",
  birthDate: "2018-01-01",
  healthIssue: false,
  healthIssueNotes: "",
  medicationUse: false,
  medicationNotes: "",
  healthObservations: "",
  positionPrimary: "indefinido",
  positionSecondary: "indefinido",
  athleteObjective: "base",
  learningStyle: "misto",
  createdAt: "2026-03-01T10:00:00.000Z",
});

const operationalReferences: AppliedPedagogicalReference[] = [
  {
    id: "reference_monthly",
    sourceDocumentId: "document_monthly",
    sourceRevisionId: "revision_monthly",
    contentHash: "content_hash_monthly",
    sourceScope: "class_planning",
    title: "Planejamento de Junho",
    origin: "Rede Esperança",
    materialType: "monthly_plan",
    evidenceLevel: "confirmed_plan",
    documentType: "monthly_plan",
    sourceDate: "2026-06-01",
    period: "2026-06",
    isPrimaryPlanningSource: true,
    sourceLocation: "Semana 3",
    excerpt: "Consolidar passe e manchete em situações simples.",
    influence: "Definiu o foco e a progressão previstos para o período.",
  },
  {
    id: "reference_report",
    sourceDocumentId: "document_report",
    sourceScope: "realized_history",
    title: "Relatório de 18 de junho",
    origin: "Turma 07-09",
    materialType: "realized_report",
    evidenceLevel: "realized_report",
    documentType: "realized_report",
    sourceDate: "2026-06-18",
    sourceLocation: "Síntese da aula",
    excerpt: "A turma manteve três trocas com apoio do professor.",
    influence: "Manteve a progressão anterior antes de aumentar a complexidade.",
  },
  {
    id: "reference_institutional",
    sourceDocumentId: "document_institutional",
    sourceScope: "institutional",
    title: "Ações institucionais de junho",
    origin: "Rede Esperança",
    materialType: "institutional_actions",
    evidenceLevel: "institutional_guidance",
    documentType: "institutional_actions",
    sourceDate: "2026-06-05",
    sourceLocation: "Orientações gerais",
    excerpt: "Priorizar participação e cooperação durante as atividades.",
    influence: "Incluiu critérios de participação e cooperação.",
  },
];

const buildSessionPlanningContext = (): SessionPlanningContext => ({
  schemaVersion: SESSION_PLANNING_CONTEXT_SCHEMA_VERSION,
  classId: "class_1",
  sessionDate: "2026-06-20",
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
  materials: ["bolas", "cones"],
  classProfile: {
    level: 1,
    daysPerWeek: 2,
    size: 1,
    heterogeneity: "baixa",
  },
  constraints: [],
  documentSupport: {
    status: "available",
    references: operationalReferences,
    warnings: [],
    retrievalMode: "contextual",
    actionDate: "2026-06-20",
  },
});

describe("convertPedagogicalPackageToTrainingPlan", () => {
  it("persists generated activity descriptions even when no extra pedagogy is provided", () => {
    const pkg = buildPedagogicalPlan({
      classGroup: buildClassGroup(),
      students: [buildStudent()],
      objective: "Passe e manchete em situações simples de jogo",
      duration: 60,
      context: "treinamento",
      constraints: [],
      materials: ["bolas", "cones"],
    });

    const plan = convertPedagogicalPackageToTrainingPlan({
      pkg,
      classId: "class_1",
      sessionDate: "2026-06-20",
      existingPlan: null,
      version: 1,
    });

    expect(plan.pedagogy?.sessionObjective).toBe(pkg.input.objective);
    expect(plan.pedagogy?.blocks?.warmup.activities).toHaveLength(
      pkg.final.warmup.activities.length
    );
    expect(plan.pedagogy?.blocks?.main.activities).toHaveLength(
      pkg.final.main.activities.length
    );
    expect(
      plan.pedagogy?.blocks?.main.activities.every((activity) =>
        Boolean(activity.description?.trim())
      )
    ).toBe(true);
    expect(plan.pedagogy?.blocks?.main.activities[0]?.name).toBe(
      pkg.final.main.activities[0]?.name
    );
  });

  it("persists the structured decision trace inside pedagogy", () => {
    const pkg = buildPedagogicalPlan({
      classGroup: buildClassGroup(),
      students: [buildStudent()],
      objective: "Passe e manchete em situações simples de jogo",
      duration: 60,
      context: "treinamento",
      constraints: [],
      materials: ["bolas", "cones"],
    });
    const decisionTrace = {
      schemaVersion: 1,
      source: {
        classId: "class_1",
        sessionDate: "2026-06-20",
        classPlanId: "cp_1",
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
          goal: "Passe e manchete",
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
        envelopeDiagnostics: ["ludico"],
      },
      teacherFacingSummary: "A aula prioriza passe porque o planejamento da semana indica Passe.",
    } satisfies NonNullable<TrainingPlanPedagogy["decisionTrace"]>;

    const plan = convertPedagogicalPackageToTrainingPlan({
      pkg,
      classId: "class_1",
      sessionDate: "2026-06-20",
      existingPlan: null,
      version: 1,
      pedagogy: {
        decisionTrace,
        focus: { skill: "passe" },
        progression: { dimension: "consistencia" },
      },
    });

    expect(plan.pedagogy?.decisionTrace).toEqual(decisionTrace);
    expect(plan.pedagogy?.decisionTrace?.schemaVersion).toBe(1);
  });

  it("persists monthly planning, realized report and institutional references", () => {
    const sessionPlanningContext = buildSessionPlanningContext();
    const pkg = buildPedagogicalPlan({
      classGroup: buildClassGroup(),
      students: [buildStudent()],
      objective: "Passe e manchete em situações simples de jogo",
      duration: 60,
      context: "treinamento",
      constraints: [],
      materials: ["bolas", "cones"],
      sessionPlanningContext,
    });

    const plan = convertPedagogicalPackageToTrainingPlan({
      pkg,
      classId: "class_1",
      sessionDate: "2026-06-20",
      existingPlan: null,
      version: 1,
    });

    expect(plan.pedagogy?.appliedReferences).toEqual(operationalReferences);
    expect(
      plan.pedagogy?.sessionPlanningContext?.documentSupport?.references
    ).toEqual(operationalReferences);
    expect(
      plan.pedagogy?.appliedReferences?.map((reference) => reference.documentType)
    ).toEqual(["monthly_plan", "realized_report", "institutional_actions"]);
    expect(
      plan.pedagogy?.appliedReferences?.find(
        (reference) => reference.documentType === "monthly_plan"
      )
    ).toMatchObject({
      period: "2026-06",
      isPrimaryPlanningSource: true,
    });
    expect(
      plan.pedagogy?.learningObjectives?.pedagogicalGuidelines
    ).toEqual(
      expect.arrayContaining(
        operationalReferences.map((reference) => reference.influence)
      )
    );
  });

  it("uses the structured primary skill in the title when passe is secondary", () => {
    const pkg = buildPedagogicalPlan({
      classGroup: buildClassGroup(),
      students: [buildStudent()],
      objective:
        "Desenvolver bloqueio, com apoio de passe, com foco em pressão de tempo.",
      duration: 60,
      context: "treinamento",
      constraints: [],
      materials: ["bolas", "cones"],
      sessionPlanningContext: {
        ...buildSessionPlanningContext(),
        skillFocus: "bloqueio",
        secondarySkill: "passe",
      },
    });

    const plan = convertPedagogicalPackageToTrainingPlan({
      pkg,
      classId: "class_1",
      sessionDate: "2026-06-20",
      existingPlan: null,
      version: 1,
    });

    expect(plan.title).toBe("Turma 07-09 · Bloqueio");
    expect(plan.pedagogy?.focus?.skill).toBe("bloqueio");
  });
});
