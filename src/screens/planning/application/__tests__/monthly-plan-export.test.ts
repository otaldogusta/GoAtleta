import type { ClassGroup, ClassPlan, DailyLessonPlan } from "../../../../core/models";
import type { MonthPlanningSummary } from "../month-planning-summary";
import { buildMonthlyPlanExportData } from "../monthly-plan-export";

const classGroup = {
  id: "class-1",
  name: "Turma 8-11",
  unit: "Rede Esperança",
  ageBand: "08-11",
  daysOfWeek: [2, 4],
  daysPerWeek: 2,
  durationMinutes: 60,
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
    expect(data.monthLabel).toBe("Junho de 2026");
    expect(data.totalWeeks).toBe(1);
    expect(data.totalSessions).toBe(2);
    expect(data.lessons[0]).toMatchObject({
      weekLabel: "SEMANA 23",
      dateLabel: "02/06/2026",
      observations: "",
    });
    expect(data.lessons[0].blocks.map((block) => block.period)).toEqual([
      "Aquecimento",
      "Parte principal",
      "Volta à calma",
    ]);
    expect(data.lessons[0].blocks[0]).toMatchObject({
      time: "10'",
      description: "Comece com 1x1 com quique e alvo.",
    });
    expect(data.lessons[1]).toMatchObject({
      weekLabel: "SEMANA 23",
      dateLabel: "04/06/2026",
    });
  });
});
