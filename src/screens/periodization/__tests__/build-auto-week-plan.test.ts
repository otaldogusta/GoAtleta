import type { ClassCalendarException, ClassGroup, DailyLessonPlan } from "../../../core/models";
import { buildAutoWeekPlan } from "../build-auto-week-plan";

const buildClassGroup = (overrides: Partial<ClassGroup> = {}): ClassGroup => ({
  id: "class_1",
  name: "Turma 09-11",
  organizationId: "org_1",
  unit: "Centro",
  unitId: "unit_1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "09-11",
  gender: "misto",
  startTime: "09:00",
  endTime: "10:00",
  durationMinutes: 60,
  daysOfWeek: [2, 4],
  daysPerWeek: 2,
  goal: "Saque e recepção",
  equipment: "quadra",
  level: 1,
  mvLevel: "MV2",
  cycleStartDate: "2026-03-23",
  cycleLengthWeeks: 12,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-03-23T10:00:00.000Z",
  ...overrides,
});

describe("buildAutoWeekPlan", () => {
  it("synthesizes week identity with skill, progression, load and class goal", () => {
    const plan = buildAutoWeekPlan({
      selectedClass: buildClassGroup(),
      weekNumber: 5,
      cycleLength: 12,
      activeCycleStartDate: "2026-03-23",
      isCompetitiveMode: false,
      calendarExceptions: [] as ClassCalendarException[],
      competitiveProfile: null,
      ageBand: "09-11",
      periodizationModel: "formacao",
      weeklySessions: 2,
      sportProfile: "voleibol",
    });

    expect(plan).toBeTruthy();
    expect(plan?.theme || "").toContain("·");
    expect(plan?.technicalFocus || "").toBeTruthy();
    expect(plan?.technicalFocus || "").toMatch(/Progressão em|\//);
    expect(plan?.physicalFocus).toBe("Coordenação, agilidade e ritmo específico");
    expect(plan?.constraints || "").toContain("Semana 5:");
    expect(plan?.constraints || "").toContain("Objetivo da turma: Saque e recepção");
    expect(plan?.constraints || "").toContain("Carga médio");
  });

  it("uses recent pedagogical history to choose a later in-month stage in weekly plan", () => {
    const recentDailyLessonPlans: DailyLessonPlan[] = [
      {
        id: "dlp_1",
        classId: "class_1",
        weeklyPlanId: "wp_1",
        date: "2026-03-31",
        dayOfWeek: 2,
        title: "Aula de continuidade",
        warmup: "duplas",
        mainPart: "mini jogo de aplicação",
        cooldown: "fechamento",
        observations: "Turma com autonomia e mais desafio no mini jogo.",
        generationContextSnapshotJson: JSON.stringify({
          nextPedagogicalStep: {
            stageId: "08-10_mar_03",
            nextStep: ["two_action_continuity", "mini_game_2x2_continuity"],
            alreadyPracticedContexts: ["application_game", "reduced_court"],
            blockRecommendations: {
              main: { contexts: ["application_game", "reduced_court"] },
            },
          },
        }),
        createdAt: "2026-03-31T10:00:00.000Z",
        updatedAt: "2026-03-31T10:00:00.000Z",
      },
    ];

    const plan = buildAutoWeekPlan({
      selectedClass: buildClassGroup({ ageBand: "08-10" }),
      weekNumber: 14,
      cycleLength: 52,
      activeCycleStartDate: "2026-01-01",
      isCompetitiveMode: false,
      calendarExceptions: [] as ClassCalendarException[],
      competitiveProfile: null,
      ageBand: "09-11",
      periodizationModel: "formacao",
      weeklySessions: 2,
      sportProfile: "voleibol",
      recentDailyLessonPlans,
    });

    expect(plan).toBeTruthy();
    expect(plan?.theme ?? "").toContain("mais estabilidade");
    expect(plan?.technicalFocus ?? "").toContain("mini jogo 2x2 com continuidade");
    expect(plan?.constraints ?? "").toContain("Seleção da etapa:");
    const snapshot = JSON.parse(plan?.generationContextSnapshotJson ?? "{}");
    expect(Array.isArray(snapshot?.weeklyOperationalStrategy?.decisions)).toBe(true);
    expect(snapshot?.weeklyOperationalStrategy?.decisions?.length).toBeGreaterThan(0);
    expect(snapshot?.weeklyOperationalStrategy?.decisions?.[0]?.sessionRole).toBeTruthy();
    expect(Array.isArray(snapshot?.weeklyOperationalStrategy?.weekRulesApplied)).toBe(true);
    expect(plan?.weekNotes ?? "").toContain("Foco da semana:");
    expect(plan?.pedagogicalRule ?? "").toContain("Foco do trimestre:");
  });
});

