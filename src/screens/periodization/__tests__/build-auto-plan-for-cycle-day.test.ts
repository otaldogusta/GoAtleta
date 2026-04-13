import type { ClassGroup, ClassPlan, RecentSessionSummary } from "../../../core/models";
import { buildPeriodizationAutoPlanForCycleDay, buildPeriodizationWeekSchedule } from "../application/build-auto-plan-for-cycle-day";

const buildClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class_1",
  name: "Turma Sub-15",
  organizationId: "org_1",
  unit: "Centro",
  unitId: "unit_1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "13-15",
  gender: "misto",
  startTime: "09:00",
  endTime: "10:30",
  durationMinutes: 90,
  daysOfWeek: [2, 4, 6],
  daysPerWeek: 3,
  goal: "Recepcao e transicao",
  equipment: "quadra",
  level: 2,
  mvLevel: "intermediario",
  cycleStartDate: "2026-03-02",
  cycleLengthWeeks: 52,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

const buildClassPlan = (overrides: Partial<ClassPlan> = {}): ClassPlan => ({
  id: "cp_1",
  classId: "class_1",
  startDate: "2026-03-30",
  weekNumber: 5,
  phase: "desenvolvimento",
  theme: "Recepcao sob pressao",
  technicalFocus: "Passe",
  physicalFocus: "Coordenacao",
  constraints: "bola rapida, leitura",
  mvFormat: "6x6",
  warmupProfile: "dinamico",
  jumpTarget: "baixo",
  rpeTarget: "PSE 5",
  source: "AUTO",
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

const buildWeekPlan = (overrides: Record<string, unknown> = {}) => ({
  week: 5,
  title: "desenvolvimento",
  focus: "Recepcao sob pressao",
  volume: "médio" as const,
  notes: ["bola rapida", "leitura"],
  jumpTarget: "baixo",
  PSETarget: "PSE 5",
  plannedSessionLoad: 450,
  plannedWeeklyLoad: 1350,
  source: "AUTO" as const,
  ...overrides,
});

const buildRecentSession = (
  overrides: Partial<RecentSessionSummary> = {}
): RecentSessionSummary => ({
  sessionDate: "2026-03-27",
  wasPlanned: true,
  wasApplied: false,
  wasEditedByTeacher: false,
  wasConfirmedExecuted: null,
  executionState: "planned_only",
  primarySkill: "passe",
  progressionDimension: "consistencia",
  dominantBlock: "main",
  fingerprint: "passe:consistencia:main",
  teacherOverrideWeight: "none",
  ...overrides,
});

describe("buildPeriodizationAutoPlanForCycleDay", () => {
  it("marks new-class generation as bootstrap when there is no recent history", () => {
    const classGroup = buildClassGroup();
    const result = buildPeriodizationAutoPlanForCycleDay({
      classGroup,
      classPlan: buildClassPlan(),
      weekPlan: buildWeekPlan(),
      cycleStartDate: classGroup.cycleStartDate,
      sessionDate: "2026-03-31",
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 3,
      dominantBlock: "Base tecnica",
    });

    expect(result.historicalConfidence).toBe("none");
    expect(result.historyMode).toBe("bootstrap");
    expect(result.coachSummary).toContain("Bootstrap");
  });

  it("produces different session labels across the same week", () => {
    const classGroup = buildClassGroup();
    const weekPlan = buildWeekPlan();

    const firstSession = buildPeriodizationAutoPlanForCycleDay({
      classGroup,
      classPlan: buildClassPlan(),
      weekPlan,
      cycleStartDate: classGroup.cycleStartDate,
      sessionDate: "2026-03-31",
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 3,
      dominantBlock: "Base tecnica",
      macroLabel: "Periodo de Base Tecnica",
      mesoLabel: "Meso 2",
    });
    const thirdSession = buildPeriodizationAutoPlanForCycleDay({
      classGroup,
      classPlan: buildClassPlan(),
      weekPlan,
      cycleStartDate: classGroup.cycleStartDate,
      sessionDate: "2026-04-04",
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 3,
      dominantBlock: "Base tecnica",
      macroLabel: "Periodo de Base Tecnica",
      mesoLabel: "Meso 2",
    });

    expect(firstSession.sessionIndexInWeek).toBe(1);
    expect(thirdSession.sessionIndexInWeek).toBe(3);
    expect(firstSession.sessionLabel).not.toBe(thirdSession.sessionLabel);
  });

  it("uses class identity to avoid collapsing distinct classes into the same session skeleton", () => {
    const weekPlan = buildWeekPlan();
    const receptionClass = buildPeriodizationAutoPlanForCycleDay({
      classGroup: buildClassGroup({ goal: "Recepcao e transicao" }),
      classPlan: buildClassPlan(),
      weekPlan,
      cycleStartDate: "2026-03-02",
      sessionDate: "2026-03-31",
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 3,
      dominantBlock: "Base tecnica",
    });
    const blockingClass = buildPeriodizationAutoPlanForCycleDay({
      classGroup: buildClassGroup({
        id: "class_2",
        goal: "Bloqueio e leitura de ataque",
      }),
      classPlan: buildClassPlan({ classId: "class_2", technicalFocus: "Bloqueio" }),
      weekPlan,
      cycleStartDate: "2026-03-02",
      sessionDate: "2026-03-31",
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 3,
      dominantBlock: "Base tecnica",
    });

    expect(receptionClass.primarySkillLabel).not.toBe(blockingClass.primarySkillLabel);
  });

  it("keeps generating with partial history while downgrading confidence from bootstrap", () => {
    const classGroup = buildClassGroup();
    const result = buildPeriodizationAutoPlanForCycleDay({
      classGroup,
      classPlan: buildClassPlan(),
      weekPlan: buildWeekPlan(),
      cycleStartDate: classGroup.cycleStartDate,
      sessionDate: "2026-03-31",
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 3,
      dominantBlock: "Base tecnica",
      recentSessions: [buildRecentSession()],
    });

    expect(result.historicalConfidence).toBe("low");
    expect(result.historyMode).toBe("partial_history");
    expect(result.sessionLabel.length).toBeGreaterThan(0);
  });

  it("changes the preview when week demand flips from recovery to intensive", () => {
    const classGroup = buildClassGroup({ daysPerWeek: 1, daysOfWeek: [2] });
    const recovery = buildPeriodizationAutoPlanForCycleDay({
      classGroup,
      classPlan: buildClassPlan({ rpeTarget: "PSE 4" }),
      weekPlan: buildWeekPlan({ volume: "baixo", PSETarget: "PSE 4", plannedSessionLoad: 320, plannedWeeklyLoad: 320 }),
      cycleStartDate: classGroup.cycleStartDate,
      sessionDate: "2026-03-31",
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 1,
      dominantBlock: "Base tecnica",
    });
    const intensive = buildPeriodizationAutoPlanForCycleDay({
      classGroup: buildClassGroup({ daysPerWeek: 3, daysOfWeek: [2, 4, 6] }),
      classPlan: buildClassPlan({ rpeTarget: "PSE 7" }),
      weekPlan: buildWeekPlan({ volume: "alto", PSETarget: "PSE 7", plannedSessionLoad: 630, plannedWeeklyLoad: 1890 }),
      cycleStartDate: classGroup.cycleStartDate,
      sessionDate: "2026-03-31",
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 3,
      dominantBlock: "Base tecnica",
    });

    expect(recovery.coachSummary).toContain("Carga regenerativa");
    expect(intensive.coachSummary).toContain("Carga intensiva");
    expect(recovery.strategy.timePressureLevel).not.toBe(intensive.strategy.timePressureLevel);
  });

  it("applies anti-repetition when a recent exact clone is present", () => {
    const classGroup = buildClassGroup();
    const weekPlan = buildWeekPlan();
    const baseline = buildPeriodizationAutoPlanForCycleDay({
      classGroup,
      classPlan: buildClassPlan(),
      weekPlan,
      cycleStartDate: classGroup.cycleStartDate,
      sessionDate: "2026-03-31",
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 3,
      dominantBlock: "Base tecnica",
    });

    const result = buildPeriodizationAutoPlanForCycleDay({
      classGroup,
      classPlan: buildClassPlan(),
      weekPlan,
      cycleStartDate: classGroup.cycleStartDate,
      sessionDate: "2026-03-31",
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 3,
      dominantBlock: "Base tecnica",
      recentSessions: [
        buildRecentSession({
          sessionDate: "2026-03-27",
          primarySkill: baseline.strategy.primarySkill,
          secondarySkill: baseline.strategy.secondarySkill,
          progressionDimension: baseline.strategy.progressionDimension,
          dominantBlock: "Base tecnica",
          fingerprint: baseline.fingerprint,
          structuralFingerprint: baseline.structuralFingerprint,
        }),
      ],
    });

    expect(result.repetitionAdjustment.detected).toBe(true);
    expect(result.fingerprint).not.toBe(baseline.fingerprint);
    expect(result.coachSummary).toContain("Variacao anti-repeticao aplicada");
  });

  it("builds a day-by-day week schedule with real training sessions only on planned days", () => {
    const classGroup = buildClassGroup({ daysOfWeek: [2, 4] });
    const schedule = buildPeriodizationWeekSchedule({
      classGroup,
      classPlan: buildClassPlan(),
      weekPlan: buildWeekPlan(),
      cycleStartDate: classGroup.cycleStartDate,
      periodizationModel: "formacao",
      sportProfile: "voleibol",
      weeklySessions: 2,
      dominantBlock: "Base tecnica",
    });

    const trainingDays = schedule.filter((item) => item.autoPlan);

    expect(trainingDays).toHaveLength(2);
    expect(trainingDays.map((item) => item.sessionIndexInWeek)).toEqual([1, 2]);
    expect(schedule.some((item) => !item.session)).toBe(true);
  });
});
