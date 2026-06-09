import { buildPedagogicalPlan, normalizePedagogicalObjective } from "../pedagogical-planning";
import type { ClassGroup, Student } from "../models";
import type { SessionPlanningContext } from "../session-planning-context";

const createClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class-1",
  name: "Sub 14",
  organizationId: "org-1",
  unit: "UniBrasil",
  unitId: "unit-1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "10-12",
  gender: "misto",
  startTime: "14:00",
  endTime: "15:00",
  durationMinutes: 60,
  daysOfWeek: [1, 3],
  daysPerWeek: 2,
  goal: "controle de bola",
  equipment: "quadra",
  level: 1,
  mvLevel: "base",
  cycleStartDate: "2026-03-01",
  cycleLengthWeeks: 4,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

const createStudent = (overrides: Partial<Student> = {}): Student => ({
  id: "student-1",
  name: "Aluno 1",
  organizationId: "org-1",
  classId: "class-1",
  age: 12,
  phone: "11999999999",
  loginEmail: "aluno1@example.com",
  guardianName: "Responsavel 1",
  guardianPhone: "11999990000",
  guardianRelation: "pai",
  birthDate: "2014-04-01",
  healthIssue: true,
  healthIssueNotes: "Dor no joelho em corrida",
  medicationUse: false,
  medicationNotes: "",
  healthObservations: "Evitar salto",
  positionPrimary: "indefinido",
  positionSecondary: "indefinido",
  athleteObjective: "base",
  learningStyle: "misto",
  createdAt: "2026-03-01T10:00:00.000Z",
  ra: null,
  raStartYear: null,
  externalId: null,
  cpfMasked: null,
  cpfHmac: null,
  rg: null,
  rgNormalized: null,
  collegeCourse: null,
  isExperimental: false,
  sourcePreRegistrationId: null,
  photoUrl: undefined,
  ...overrides,
});

const collectFinalActivityText = (result: ReturnType<typeof buildPedagogicalPlan>) =>
  [result.final.warmup, result.final.main, result.final.cooldown]
    .flatMap((block) => block.activities)
    .map((activity) =>
      [
        activity.name,
        activity.description,
        activity.organization,
        activity.execution,
        activity.presentation?.standardText,
        activity.primarySkill,
      ].join(" ")
    )
    .join(" ");

const createSessionPlanningContext = (
  overrides: Partial<SessionPlanningContext> = {}
): SessionPlanningContext => ({
  classId: "c_1775903848643",
  sessionDate: "2026-06-20",
  ageBand: "07-09",
  sport: "volleyball",
  skillFocus: "passe",
  secondarySkill: "levantamento",
  cycleGoal: "Recepção e continuidade",
  weekGoal: "Passe e manchete para recepção",
  weekNumber: 4,
  sessionIndexInWeek: 1,
  periodizationPhase: "base",
  progressionDimension: "consistencia",
  pedagogicalIntent: "technical_foundation",
  loadIntent: "moderado",
  previousSessionSummary: "Passe em duplas",
  recentDifficulties: ["comunicacao"],
  recentActivityFamilies: ["alvo_zona"],
  upcomingEvents: [],
  availableDuration: 60,
  materials: ["bolas", "cones"],
  classProfile: { level: 1, daysPerWeek: 2, size: 10, heterogeneity: "baixa" },
  constraints: [],
  ...overrides,
});

describe("pedagogical-planning", () => {
  it("generates a volleyball plan with analysis, adaptations and final version", () => {
    const result = buildPedagogicalPlan({
      classGroup: createClassGroup(),
      students: [createStudent()],
      objective: "controle de bola",
      context: "escolar",
      constraints: ["sem quadra", "tempo reduzido"],
      materials: ["bola", "cone"],
      duration: 45,
    });

    expect(result.analysis.level).toBe("baixo");
    expect(result.analysis.heterogeneity).toBe("baixa");
    expect(result.analysis.hardConstraints).toContain("evitar_impacto");
    expect(result.analysis.softConstraints).toContain("sem_quadra");
    expect(result.analysis.softConstraints).toContain("tempo_reduzido");
    expect(result.generated.basePlanKind).toBe("volleyball");
    expect(result.draft.objective).toBe("controle_bola");
    expect(result.draft.adaptations.length).toBeGreaterThan(0);
    expect(result.draft.explanations.length).toBeGreaterThan(0);
    expect(result.final.finalizedAt).toBeTruthy();
    expect(result.final.generatedAt).toBeTruthy();
    expect(result.final.edited).toBe(false);
  });

  it("normalizes objective text before planning", () => {
    expect(normalizePedagogicalObjective("Jogo reduzido com foco em passe")).toBe("jogo_reduzido");
  });

  it("falls back to progression planning outside volleyball", () => {
    const result = buildPedagogicalPlan({
      classGroup: createClassGroup({ modality: "fitness", goal: "resistencia" }),
      students: [createStudent({ healthIssue: false, healthIssueNotes: "", healthObservations: "" })],
      objective: "resistencia",
      context: "treinamento",
      constraints: ["espaco_limitado"],
      materials: ["colchonete"],
      duration: 30,
    });

    expect(result.generated.basePlanKind).toBe("progression");
    expect(result.analysis.softConstraints).toContain("espaco_limitado");
    expect(result.draft.objective).toBe("resistencia");
    expect(result.draft.main.activities.length).toBeGreaterThan(0);
  });

  it("generates humanized coupled activities for base volleyball passe", () => {
    const result = buildPedagogicalPlan({
      classGroup: createClassGroup({
        name: "Turma 07-09",
        ageBand: "07-09",
        goal: "Passe e manchete",
      }),
      students: [createStudent({ age: 8, healthIssue: false, healthIssueNotes: "", healthObservations: "" })],
      objective: "Passe",
      context: "treinamento",
      constraints: [],
      materials: ["bolas", "cones"],
      duration: 60,
    });

    const firstMain = result.final.main.activities.find((activity) => activity.primarySkill === "passe");
    const fullText = [
      result.final.warmup,
      result.final.main,
      result.final.cooldown,
    ]
      .flatMap((block) => block.activities)
      .map((activity) => `${activity.name} ${activity.description}`)
      .join(" ");

    expect(result.generated.basePlanKind).toBe("volleyball");
    expect(firstMain?.organization).toBeTruthy();
    expect(firstMain?.execution).toBeTruthy();
    expect(firstMain?.coachFocus).toBeTruthy();
    expect(firstMain?.successCriteria).toBeTruthy();
    expect(firstMain?.adaptation).toBeTruthy();
    expect(firstMain?.primarySkill).toBe("passe");
    expect(fullText).toContain("Organização:");
    expect(fullText).toContain("primeiro contato");
    expect(fullText).not.toContain("vwv_");
    expect(fullText).not.toContain("Exploração guiada");
    expect(fullText.toLowerCase()).not.toContain("levantamento");
  });

  it.each([
    ["without session planning context", undefined],
    ["with pass context and levantamento as secondary skill", createSessionPlanningContext()],
  ])("keeps real 07-09 pass generation on first-contact activities %s", (_label, sessionPlanningContext) => {
    const result = buildPedagogicalPlan({
      classGroup: createClassGroup({
        id: "c_1775903848643",
        name: "Turma 07-09",
        ageBand: "07-09",
        goal: "Passe e manchete para recepção",
      }),
      students: [createStudent({ age: 8, healthIssue: false, healthIssueNotes: "", healthObservations: "" })],
      objective: "Passe e manchete para recepção",
      context: "treinamento",
      constraints: [],
      materials: ["bolas", "cones"],
      duration: 60,
      sessionPlanningContext,
    });
    const text = collectFinalActivityText(result);
    const normalizedText = text.toLowerCase();

    expect(result.generated.basePlanKind).toBe("volleyball");
    expect(text).toMatch(/passe|manchete|recepção|recepcao|primeiro contato/i);
    expect(text).not.toContain("Passe orientado");
    expect(text).not.toContain("Cone pega-toque");
    expect(text).not.toContain("Introdução do toque com cone");
    expect(text).not.toContain("Mini jogo com segundo contato definido");
    expect(normalizedText).not.toContain("segundo contato");
    expect(normalizedText).not.toContain("levantamento");
    expect(normalizedText).not.toContain("levantador");
  });
});
