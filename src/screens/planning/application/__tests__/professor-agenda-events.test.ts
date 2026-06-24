import type { ClassPlan, DailyLessonPlan } from "../../../../core/models";
import type { WeekSessionPreview } from "../../../periodization/application/build-week-session-preview";
import {
  buildProfessorAgendaEvents,
  buildProfessorMonthCalendar,
} from "../professor-agenda-events";

const makePlan = (overrides: Partial<ClassPlan> = {}): ClassPlan => ({
  id: "week-23",
  classId: "class-1",
  cycleId: "cycle-1",
  startDate: "2026-06-04",
  weekNumber: 23,
  phase: "Fundamentos",
  theme: "Ponte 1x1 -> 2x2",
  technicalFocus: "Passe",
  physicalFocus: "Deslocamento",
  generalObjective: "Organizar a bola em jogo com comunicação.",
  specificObjective: "Chamar a bola e cooperar em dupla.",
  constraints: "",
  mvFormat: "",
  warmupProfile: "",
  jumpTarget: "",
  rpeTarget: "",
  source: "MANUAL",
  weeklySessions: 2,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

const makeSession = (date: string, sessionIndex: number): WeekSessionPreview => {
  const [year, month, day] = date.split("-");
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  return {
    sessionIndex,
    weekday,
    weekdayLabel: labels[weekday],
    date,
    dateLabel: `${day}/${month}/${year}`,
    shortLabel: `${labels[weekday]} ${day}/${month}`,
  };
};

const makeDailyPlan = (overrides: Partial<DailyLessonPlan> = {}): DailyLessonPlan => ({
  id: "daily-1",
  classId: "class-1",
  weeklyPlanId: "week-23",
  date: "2026-06-02",
  dayOfWeek: 2,
  title: "Ponte 1x1 -> 2x2",
  blocksJson: JSON.stringify([
    {
      key: "warmup",
      label: "Aquecimento",
      durationMinutes: 10,
      activities: [{ id: "a1", name: "1x1 com quique", description: "Comece com 1x1 com quique e alvo." }],
    },
    {
      key: "main",
      label: "Parte principal",
      durationMinutes: 45,
      activities: [{ id: "m1", name: "2x2 cooperativo", description: "Passe para 2x2 cooperativo." }],
    },
    {
      key: "cooldown",
      label: "Volta à calma",
      durationMinutes: 5,
      activities: [{ id: "c1", name: "Roda de conversa", description: "Feche com pergunta curta." }],
    },
  ]),
  warmup: "Comece com 1x1 com quique e alvo.",
  mainPart: "Passe para 2x2 cooperativo.",
  cooldown: "Roda de conversa.",
  observations: "",
  generationContextSnapshotJson: "{}",
  syncStatus: "in_sync",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

describe("professor agenda events", () => {
  it("builds the same June dates used by the monthly planning calendar", () => {
    const plan = makePlan();
    const sessions = [makeSession("2026-06-02", 1), makeSession("2026-06-04", 2)];
    const dailyPlan = makeDailyPlan();

    const events = buildProfessorAgendaEvents({
      weeklyItems: [{ plan, label: "Semana 23", sessions }],
      dailyPlansByKey: { "week-23::2026-06-02": dailyPlan },
    });
    const calendar = buildProfessorMonthCalendar({ monthKey: "2026-06", events });

    expect(events.map((event) => event.date)).toEqual(["2026-06-02", "2026-06-04"]);
    expect(events[0]?.statusLabel).toBe("Aula pronta");
    expect(events[1]?.statusLabel).toBe("Planejada");
    expect(calendar[0]?.date).toBe("2026-05-31");
    expect(calendar.find((day) => day.date === "2026-06-02")?.events[0]?.title).toBe("Ponte 1x1 -> 2x2");
  });

  it("keeps internal readiness language out of the professor-facing event", () => {
    const plan = makePlan({
      theme: "confidence medium riskFlags baixa evidência",
      generalObjective: "Histórico parcial com risco de salto",
    });
    const session = makeSession("2026-06-02", 1);
    const dailyPlan = makeDailyPlan({
      title: "confidence medium riskFlags baixa evidência",
      warmup: "Faça 1x1 com alvo.",
      mainPart: "riskFlags salto_de_complexidade",
      cooldown: "readinessState baixo",
    });

    const [event] = buildProfessorAgendaEvents({
      weeklyItems: [{ plan, label: "Semana 23", sessions: [session] }],
      dailyPlansByKey: { "week-23::2026-06-02": dailyPlan },
    });

    const publicText = JSON.stringify({
      title: event.title,
      objective: event.objective,
      guidance: event.guidance,
    });

    expect(publicText).not.toMatch(/confidence|riskFlags|readinessState|baixa evidência|risco de salto|Histórico parcial/i);
    expect(event.guidance.doNow.join(" ")).toContain("1x1 com quique");
  });
});
