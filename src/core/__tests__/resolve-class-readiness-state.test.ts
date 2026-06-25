import { applyReadinessGuardToSessionStrategy } from "../cycle-day-planning/apply-readiness-guard-to-session-strategy";
import { buildAdaptiveLessonEnvelope } from "../cycle-day-planning/build-adaptive-lesson-envelope";
import { buildSessionCoachGuidance } from "../cycle-day-planning/build-session-coach-guidance";
import { resolveClassReadinessState } from "../cycle-day-planning/resolve-class-readiness-state";
import { getGameFormatLevelRank } from "../cycle-day-planning/readiness-levels";
import type {
  ClassGroup,
  ClassReadinessState,
  GameFormatLevel,
  RecentSessionSummary,
  SessionStrategy,
  Student,
} from "../models";

const buildClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class_1",
  name: "Primeiros Saques",
  organizationId: "org_1",
  unit: "Centro",
  unitId: "unit_1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "08-11",
  gender: "misto",
  startTime: "09:00",
  endTime: "10:00",
  durationMinutes: 60,
  daysOfWeek: [2, 4],
  daysPerWeek: 2,
  goal: "Organizacao para jogo reduzido",
  equipment: "quadra",
  level: 1,
  mvLevel: "base",
  cycleStartDate: "2026-06-01",
  cycleLengthWeeks: 52,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-01-01T10:00:00.000Z",
  ...overrides,
});

const buildStudent = (overrides: Partial<Student> = {}): Student => ({
  id: "student_1",
  name: "Aluno",
  organizationId: "org_1",
  classId: "class_1",
  age: 10,
  phone: "",
  loginEmail: "",
  guardianName: "",
  guardianPhone: "",
  guardianRelation: "",
  birthDate: "2016-01-01",
  healthIssue: false,
  healthIssueNotes: "",
  medicationUse: false,
  medicationNotes: "",
  healthObservations: "",
  positionPrimary: "indefinido",
  positionSecondary: "indefinido",
  athleteObjective: "base",
  learningStyle: "misto",
  createdAt: "2026-01-01T10:00:00.000Z",
  ...overrides,
});

const buildStrategy = (overrides: Partial<SessionStrategy> = {}): SessionStrategy => ({
  primarySkill: "passe",
  secondarySkill: "levantamento",
  progressionDimension: "transferencia_jogo",
  pedagogicalIntent: "team_organization",
  loadIntent: "moderado",
  drillFamilies: ["jogo_condicionado", "cooperacao", "saque_direcionado"],
  forbiddenDrillFamilies: [],
  oppositionLevel: "high",
  timePressureLevel: "high",
  gameTransferLevel: "high",
  ...overrides,
});

const buildRecentSession = (
  overrides: Partial<RecentSessionSummary> = {}
): RecentSessionSummary => ({
  sessionDate: "2026-06-13",
  wasPlanned: true,
  wasApplied: true,
  wasEditedByTeacher: false,
  wasConfirmedExecuted: true,
  executionState: "confirmed_executed",
  primarySkill: "passe",
  secondarySkill: "levantamento",
  progressionDimension: "tomada_decisao",
  dominantBlock: "main",
  fingerprint: "passe:tomada_decisao:main",
  teacherOverrideWeight: "none",
  ...overrides,
});

const buildReadiness = (
  appliedCoreLevel: GameFormatLevel,
  overrides: Partial<ClassReadinessState> = {}
): ClassReadinessState => ({
  classId: "class_1",
  plannedGameLevel: appliedCoreLevel,
  estimatedGameLevel: appliedCoreLevel,
  appliedCoreLevel,
  confidence: "medium",
  riskFlags: [],
  recommendation: "consolidar",
  reason: [],
  teacherMessage: "Hoje mantenha a aula ajustada.",
  ...overrides,
});

describe("resolveClassReadinessState", () => {
  it("does not apply L7 when periodization is high and history is empty", () => {
    const readiness = resolveClassReadinessState({
      classGroup: buildClassGroup({ level: 1 }),
      sessionDate: "2026-06-20",
      historicalConfidence: "none",
      recentSessions: [],
      sourceStrategy: buildStrategy(),
    });

    expect(readiness.plannedGameLevel).toBe("L7_3x3_organizado");
    expect(readiness.appliedCoreLevel).not.toBe("L7_3x3_organizado");
    expect(getGameFormatLevelRank(readiness.appliedCoreLevel)).toBeLessThanOrEqual(
      getGameFormatLevelRank("L4_2x2_cooperativo")
    );
  });

  it("caps an 8-11 beginner group at L3/L4 for a high-complexity plan", () => {
    const readiness = resolveClassReadinessState({
      classGroup: buildClassGroup({ ageBand: "08-11", level: 1 }),
      sessionDate: "2026-06-20",
      historicalConfidence: "none",
      recentSessions: [],
      sourceStrategy: buildStrategy(),
    });

    expect(getGameFormatLevelRank(readiness.appliedCoreLevel)).toBeLessThanOrEqual(
      getGameFormatLevelRank("L4_2x2_cooperativo")
    );
  });

  it("adds recurring difficulty internally and reduces aggressive complexity", () => {
    const readiness = resolveClassReadinessState({
      classGroup: buildClassGroup({ level: 2 }),
      sessionDate: "2026-06-20",
      historicalConfidence: "medium",
      recentSessions: [
        buildRecentSession({
          progressionDimension: "tomada_decisao",
          pedagogicalFeedbackSignals: ["recurring_technical_difficulty"],
        }),
      ],
      sourceStrategy: buildStrategy(),
    });

    expect(readiness.riskFlags).toContain("dificuldade_recorrente");
    expect(readiness.riskFlags).toContain("salto_de_complexidade");
    expect(getGameFormatLevelRank(readiness.appliedCoreLevel)).toBeLessThan(
      getGameFormatLevelRank(readiness.plannedGameLevel)
    );
  });

  it("keeps the planned level with strong history and no risk", () => {
    const readiness = resolveClassReadinessState({
      classGroup: buildClassGroup({ level: 3 }),
      sessionDate: "2026-06-20",
      historicalConfidence: "high",
      recentSessions: [buildRecentSession({ progressionDimension: "transferencia_jogo" })],
      sourceStrategy: buildStrategy(),
    });

    expect(readiness.confidence).toBe("high");
    expect(readiness.riskFlags).toEqual([]);
    expect(readiness.appliedCoreLevel).toBe(readiness.plannedGameLevel);
  });

  it("turns more than 25% new students into entry-station guidance", () => {
    const readiness = resolveClassReadinessState({
      classGroup: buildClassGroup({ level: 2 }),
      sessionDate: "2026-06-20",
      historicalConfidence: "medium",
      recentSessions: [buildRecentSession()],
      sourceStrategy: buildStrategy(),
      students: [
        buildStudent({ id: "old_1", createdAt: "2026-01-01T10:00:00.000Z" }),
        buildStudent({ id: "old_2", createdAt: "2026-01-01T10:00:00.000Z" }),
        buildStudent({ id: "new_1", createdAt: "2026-06-10T10:00:00.000Z" }),
      ],
    });
    const envelope = buildAdaptiveLessonEnvelope({
      readinessState: readiness,
      strategy: buildStrategy(),
    });
    const guidance = buildSessionCoachGuidance({
      readinessState: readiness,
      adaptiveEnvelope: envelope,
      classGroup: buildClassGroup(),
    });

    expect(readiness.riskFlags).toEqual(
      expect.arrayContaining(["alunos_novos", "turma_heterogenea"])
    );
    expect(guidance.setupHint).toMatch(/estações por nível/i);
  });
});

describe("applyReadinessGuardToSessionStrategy", () => {
  it("maps L0/L1 to low opposition and low transfer", () => {
    const guarded = applyReadinessGuardToSessionStrategy({
      strategy: buildStrategy(),
      readinessState: buildReadiness("L1_controle_individual"),
    });

    expect(guarded.oppositionLevel).toBe("low");
    expect(guarded.gameTransferLevel).toBe("low");
  });

  it("keeps L4/L5 in the 2x2 cooperative/decision range", () => {
    const guarded = applyReadinessGuardToSessionStrategy({
      strategy: buildStrategy(),
      readinessState: buildReadiness("L4_2x2_cooperativo"),
    });

    expect(guarded.oppositionLevel).toBe("medium");
    expect(guarded.gameTransferLevel).toBe("medium");
    expect(guarded.drillFamilies).toContain("cooperacao");
  });

  it("allows 3x3 complexity only when the applied level permits it", () => {
    const allowed = applyReadinessGuardToSessionStrategy({
      strategy: buildStrategy(),
      readinessState: buildReadiness("L7_3x3_organizado"),
    });
    const blocked = applyReadinessGuardToSessionStrategy({
      strategy: buildStrategy(),
      readinessState: buildReadiness("L4_2x2_cooperativo"),
    });

    expect(allowed.oppositionLevel).toBe("high");
    expect(allowed.gameTransferLevel).toBe("high");
    expect(blocked.oppositionLevel).toBe("medium");
    expect(blocked.gameTransferLevel).toBe("medium");
  });
});

describe("buildSessionCoachGuidance", () => {
  it("always creates action buckets and does not leak internal terms", () => {
    const readiness = resolveClassReadinessState({
      classGroup: buildClassGroup({ level: 1 }),
      sessionDate: "2026-06-20",
      historicalConfidence: "none",
      recentSessions: [],
      sourceStrategy: buildStrategy(),
    });
    const envelope = buildAdaptiveLessonEnvelope({
      readinessState: readiness,
      strategy: buildStrategy(),
    });
    const guidance = buildSessionCoachGuidance({
      readinessState: readiness,
      adaptiveEnvelope: envelope,
      classGroup: buildClassGroup(),
    });
    const serialized = JSON.stringify(guidance);

    expect(guidance.doNow.length).toBeGreaterThan(0);
    expect(guidance.avoidToday.length).toBeGreaterThan(0);
    expect(guidance.advanceIf.length).toBeGreaterThan(0);
    expect(guidance.simplifyIf.length).toBeGreaterThan(0);
    expect(serialized).not.toMatch(
      /confidence|riskFlags|readinessState|estimatedGameLevel|appliedCoreLevel|baixa evidência|risco de salto/i
    );
  });
});
