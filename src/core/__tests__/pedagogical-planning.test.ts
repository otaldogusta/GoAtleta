import { buildPedagogicalPlan, normalizePedagogicalObjective } from "../pedagogical-planning";
import type { ClassGroup, Student } from "../models";

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
});
