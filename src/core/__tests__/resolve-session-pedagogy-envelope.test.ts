import type { ClassGroup, Student } from "../models";
import { buildPedagogicalPlan } from "../pedagogical-planning";
import {
    applySessionPedagogyEnvelope,
    resolveSessionPedagogyEnvelope,
} from "../resolve-session-pedagogy-envelope";

const createClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class-1",
  name: "Sub 11",
  organizationId: "org-1",
  unit: "UniBrasil",
  unitId: "unit-1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "08-11",
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
  age: 9,
  phone: "",
  loginEmail: "",
  guardianName: "Responsável 1",
  guardianPhone: "",
  guardianRelation: "mãe",
  birthDate: "2017-04-01",
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

describe("resolve-session-pedagogy-envelope", () => {
  it("builds an infantil envelope for fundamental classes", () => {
    const envelope = resolveSessionPedagogyEnvelope({
      ageBand: "08-11",
      developmentStage: "fundamental",
      objectiveType: "tecnico",
      historyMode: "bootstrap",
    });

    expect(envelope.languageProfile).toBe("infantil");
    expect(envelope.feedbackStyle).toBe("positivo_curto");
    expect(envelope.mainStyle).toContain("desafio simples");
    expect(envelope.avoidPatterns).toContain("sem dor reportada");
  });

  it("enforces primary skill coherence in main and pedagogical cooldown tone", () => {
    const plan = buildPedagogicalPlan({
      classGroup: createClassGroup(),
      students: [createStudent()],
      objective: "saque com alvo",
      context: "treinamento",
      constraints: [],
      materials: ["bola"],
      duration: 60,
    });

    plan.final.main.summary = "Passe orientado com repetições.";
    plan.final.main.activities = [
      {
        id: "main_1",
        name: "Passe orientado",
        description: "Passe em dupla com controle.",
      },
    ];
    plan.final.cooldown.summary = "Fechar com feedback simples e celebração de progresso.";
    plan.final.cooldown.activities = [
      {
        id: "cool_1",
        name: "Encerramento",
        description: "Fechar com feedback simples e celebração de progresso.",
      },
    ];

    const envelope = resolveSessionPedagogyEnvelope({
      ageBand: "08-11",
      developmentStage: "fundamental",
      objectiveType: "tecnico",
      historyMode: "bootstrap",
    });
    const result = applySessionPedagogyEnvelope({
      plan,
      envelope,
      primarySkill: "saque",
    });

    expect(result.final.main.summary || "").toContain("saque");
    expect(result.final.main.activities[0]?.name || "").toContain("Saque");
    expect(result.final.main.activities[0]?.name || "").not.toContain("Passe orientado");
    expect(result.final.main.activities[0]?.description || "").toContain("controle");
    expect(result.final.cooldown.summary || "").toContain("Fechamento");
    expect(result.final.cooldown.activities[0]?.name || "").toContain("Roda rápida");
    expect(result.final.cooldown.activities[0]?.description || "").toContain("saque");
  });
});
