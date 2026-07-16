import type { ClassGroup, Student, TrainingPlanPedagogy } from "../../../../core/models";
import { buildPedagogicalPlan } from "../../../../core/pedagogical-planning";
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
});
