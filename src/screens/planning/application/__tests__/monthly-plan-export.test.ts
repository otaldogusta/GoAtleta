import type { ClassGroup, ClassPlan, DailyLessonPlan } from "../../../../core/models";
import type { MonthPlanningSummary } from "../month-planning-summary";
import { buildMonthlyPlanExportData, buildWeeklyPlanExportData } from "../monthly-plan-export";

const classGroup = {
  id: "class-1",
  name: "Turma 8-11",
  unit: "Rede Esperança",
  ageBand: "08-11",
  daysOfWeek: [2, 4],
  daysPerWeek: 2,
  durationMinutes: 60,
  startTime: "14:00",
  endTime: "15:00",
} as ClassGroup;

const june = {
  monthKey: "2026-06",
  label: "junho de 2026",
  year: 2026,
  month: 6,
  weekCount: 1,
  estimatedLessonCount: 2,
  hasPlans: true,
} as MonthPlanningSummary;

const plan = {
  id: "week-june-start",
  classId: "class-1",
  cycleId: "cycle-1",
  startDate: "2026-06-04",
  weekNumber: 23,
  phase: "Fundamentos",
  theme: "Ponte 1x1 -> 2x2",
  technicalFocus: "Controle",
  pedagogicalRule: "Como manter a bola jogável após o primeiro contato?",
  physicalFocus: "Deslocamento",
  constraints: "",
  mvFormat: "",
  warmupProfile: "",
  jumpTarget: "",
  rpeTarget: "",
  source: "MANUAL",
  weeklySessions: 2,
  createdAt: "2026-06-04T00:00:00.000Z",
  updatedAt: "2026-06-04T00:00:00.000Z",
} as ClassPlan;

describe("buildMonthlyPlanExportData", () => {
  it("exports complete lesson plans using the first real class day", () => {
    const savedDailyPlan = {
      id: "daily-1",
      classId: "class-1",
      weeklyPlanId: "week-june-start",
      date: "2026-06-02",
      dayOfWeek: 2,
      title: "Ponte 1x1 -> 2x2",
      warmup: "Comece com 1x1 com quique e alvo.",
      mainPart: "Avance para 2x2 cooperativo no bloco principal.",
      cooldown: "Roda de conversa sobre comunicação.",
      observations: "Evite 3x3 livre no começo.",
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    } as DailyLessonPlan;

    const data = buildMonthlyPlanExportData({
      classGroup,
      month: june,
      plans: [plan],
      dailyPlansByKey: {
        "week-june-start::2026-06-02": savedDailyPlan,
      },
      generatedAt: new Date("2026-06-23T10:00:00"),
    });

    expect(data.className).toBe("Turma 8-11");
    expect(data.ageGroup).toBe("8–11");
    expect(data.monthLabel).toBe("Junho de 2026");
    expect(data.totalWeeks).toBe(1);
    expect(data.totalSessions).toBe(2);
    expect(data.lessons[0]).toMatchObject({
      weekLabel: expect.stringContaining("SEMANA 23"),
      dateLabel: expect.stringMatching(/^\d{2}\/06\/2026 \(.+\)$/),
      timeLabel: "14h às 15h",
      situationProblem: "Como manter a bola jogável após o primeiro contato?",
      observations: "",
    });
    expect(data.lessons[0].specificObjective).toContain("Conceitual:");
    expect(data.lessons[0].specificObjective).toContain("Atitudinal:");
    expect(data.lessons[0].specificObjective).toContain("Procedimental:");
    expect(data.lessons[0].specificObjective).toContain("Avance para 2x2 cooperativo");
    expect(data.lessons[0].blocks.map((block) => block.period)).toEqual([
      "Aquecimento",
      "Parte principal",
      "Volta à calma",
    ]);
    expect(data.lessons[0].blocks[0]).toMatchObject({
      time: "10'",
    });
    expect(data.lessons[0].blocks[0].description).toEqual(expect.any(String));
    expect(data.lessons[0].blocks[1].activities).toMatch(/^1\. /);
    expect(data.lessons[0].blocks[1].description).toMatch(/^1\. /);
    expect(data.lessons[1]).toMatchObject({
      weekLabel: expect.stringContaining("SEMANA 23"),
      dateLabel: expect.stringMatching(/^\d{2}\/06\/2026 \(.+\)$/),
    });
  });

  it("exports a selected week with the same lesson-sheet data", () => {
    const data = buildWeeklyPlanExportData({
      classGroup,
      plan,
      dailyPlansByKey: {},
    });

    expect(data.totalWeeks).toBe(1);
    expect(data.lessons.length).toBeGreaterThan(0);
    expect(data.lessons[0]).toMatchObject({
      weekLabel: expect.stringContaining("SEMANA 23"),
      timeLabel: "14h às 15h",
    });
  });
});
