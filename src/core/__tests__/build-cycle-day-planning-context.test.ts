import { buildCycleDayPlanningContext } from "../cycle-day-planning/build-cycle-day-planning-context";
import type { ClassGroup, ClassPlan, RecentSessionSummary } from "../models";

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
  goal: "Desenvolver recepcao e jogo",
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

const buildRecentSession = (
  overrides: Partial<RecentSessionSummary> = {}
): RecentSessionSummary => ({
  sessionDate: "2026-04-05",
  wasPlanned: true,
  wasApplied: true,
  wasEditedByTeacher: false,
  wasConfirmedExecuted: true,
  executionState: "confirmed_executed",
  primarySkill: "saque",
  progressionDimension: "pressao_tempo",
  dominantBlock: "main",
  fingerprint: "saque:pressao_tempo:main",
  teacherOverrideWeight: "none",
  ...overrides,
});

describe("buildCycleDayPlanningContext", () => {
  it("builds a complete context for a new class with no history", () => {
    const context = buildCycleDayPlanningContext({
      classGroup: buildClassGroup(),
      classPlan: buildClassPlan(),
      sessionDate: "2026-04-07",
      recentSessions: [],
    });

    expect(context.historicalConfidence).toBe("none");
    expect(context.recentSessions).toEqual([]);
    expect(context.primarySkill).toBe("passe");
    expect(context.targetPse).toBe(5);
    expect(context.plannedSessionLoad).toBe(450);
    expect(context.plannedWeeklyLoad).toBe(1350);
    expect(context.sessionIndexInWeek).toBe(1);
  });

  it("keeps session index explicit so the same week differs across session positions", () => {
    const classGroup = buildClassGroup({ daysOfWeek: [2, 4, 6] });
    const firstSession = buildCycleDayPlanningContext({
      classGroup,
      classPlan: buildClassPlan(),
      sessionDate: "2026-04-07",
      recentSessions: [],
    });
    const thirdSession = buildCycleDayPlanningContext({
      classGroup,
      classPlan: buildClassPlan(),
      sessionDate: "2026-04-11",
      recentSessions: [],
    });

    expect(firstSession.sessionIndexInWeek).toBe(1);
    expect(thirdSession.sessionIndexInWeek).toBe(3);
    expect(firstSession).not.toEqual(thirdSession);
  });

  it("injects recent history and confidence when summaries are available", () => {
    const context = buildCycleDayPlanningContext({
      classGroup: buildClassGroup(),
      classPlan: buildClassPlan({ technicalFocus: "", theme: "Transicao" }),
      sessionDate: "2026-04-12",
      recentSessions: [
        buildRecentSession(),
        buildRecentSession({
          sessionDate: "2026-04-03",
          executionState: "teacher_edited",
          wasEditedByTeacher: true,
          teacherOverrideWeight: "strong",
        }),
      ],
    });

    expect(context.historicalConfidence).toBe("high");
    expect(context.recentSessions).toHaveLength(2);
    expect(context.dominantBlock).toBe("main");
    expect(context.mustAvoidRepeating.length).toBeGreaterThan(0);
    expect(context.mustProgressFrom).toContain("saque");
  });

  it("uses class goal text to differentiate primary skill across classes", () => {
    const foundationalContext = buildCycleDayPlanningContext({
      classGroup: buildClassGroup({ goal: "Fundamentos" }),
      classPlan: buildClassPlan({ technicalFocus: "", theme: "" }),
      sessionDate: "2026-04-07",
      recentSessions: [],
    });
    const enduranceContext = buildCycleDayPlanningContext({
      classGroup: buildClassGroup({ id: "class_2", goal: "Resistencia" }),
      classPlan: buildClassPlan({ classId: "class_2", technicalFocus: "", theme: "" }),
      sessionDate: "2026-04-07",
      recentSessions: [],
    });

    expect(foundationalContext.primarySkill).toBe("passe");
    expect(enduranceContext.primarySkill).toBe("defesa");
  });
});
