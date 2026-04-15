import type { ClassGroup, Student } from "../models";
import { buildPedagogicalPlan } from "../pedagogical-planning";
import { sanitizePlanForAgeBand } from "../sanitize-plan-for-age-band";

const createClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class-1",
  name: "Sub 11",
  organizationId: "org-1",
  unit: "UniBrasil",
  unitId: "unit-1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "09-11",
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
  age: 10,
  phone: "",
  loginEmail: "",
  guardianName: "Responsavel 1",
  guardianPhone: "",
  guardianRelation: "mae",
  birthDate: "2016-04-01",
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

describe("sanitizePlanForAgeBand", () => {
  it("rewrites adult warmup language for fundamental age bands", () => {
    const plan = buildPedagogicalPlan({
      classGroup: createClassGroup(),
      students: [createStudent()],
      objective: "controle de bola",
      context: "treinamento",
      constraints: [],
      materials: ["bola"],
      duration: 60,
    });

    plan.draft.warmup.summary = "Todos os atletas completam ativacao de ombro/core sem dor reportada.";
    plan.generated.warmup.summary = "Todos os atletas completam ativacao de ombro/core sem dor reportada.";
    plan.final.warmup.summary = "Todos os atletas completam ativacao de ombro/core sem dor reportada.";
    plan.draft.warmup.activities = [
      {
        id: "warmup_1",
        name: "Ativacao de ombro/core",
        description: "Todos os atletas completam ativacao de ombro/core sem dor reportada.",
      },
    ];
    plan.generated.warmup.activities = [
      {
        id: "warmup_1",
        name: "Ativacao de ombro/core",
        description: "Todos os atletas completam ativacao de ombro/core sem dor reportada.",
      },
    ];
    plan.final.warmup.activities = [
      {
        id: "warmup_1",
        name: "Ativacao de ombro/core",
        description: "Todos os atletas completam ativacao de ombro/core sem dor reportada.",
      },
    ];

    const result = sanitizePlanForAgeBand(plan, "09-11");

    expect(result.diagnostics.developmentStage).toBe("fundamental");
    expect(result.diagnostics.usedAgeSanitizer).toBe(true);
    expect(result.diagnostics.warmupSource).toBe("age_sanitizer");
    expect(result.diagnostics.ageSanitizerReasons).toContain("clinical_warmup_language");
    expect(result.package.final.warmup.summary).not.toContain("sem dor reportada");
    expect(result.package.final.warmup.activities[0]?.name).toContain("Brincadeira");
    expect(result.package.final.warmup.activities[0]?.description).toContain("equilíbrio");
  });

  it("keeps engine output for older age bands", () => {
    const plan = buildPedagogicalPlan({
      classGroup: createClassGroup({ ageBand: "13-15", level: 2 }),
      students: [createStudent({ age: 14, birthDate: "2012-04-01" })],
      objective: "controle de bola",
      context: "treinamento",
      constraints: [],
      materials: ["bola"],
      duration: 60,
    });

    plan.final.warmup.summary = "Todos os atletas completam ativacao de ombro/core sem dor reportada.";

    const result = sanitizePlanForAgeBand(plan, "13-15");

    expect(result.diagnostics.developmentStage).toBe("especializado");
    expect(result.diagnostics.usedAgeSanitizer).toBe(false);
    expect(result.diagnostics.warmupSource).toBe("engine");
    expect(result.diagnostics.ageSanitizerReasons).toEqual([]);
    expect(result.package.final.warmup.summary).toContain("sem dor reportada");
  });
});
