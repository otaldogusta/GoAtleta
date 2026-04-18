import type { WeekSessionPreview } from "../../screens/periodization/application/build-week-session-preview";
import { buildAutoDailyLessonPlan } from "../../screens/planning/application/regenerate-daily-lesson-plan";
import type { ClassPlan } from "../models";
import { resolveNextPedagogicalStepFromPeriodization } from "../pedagogy/resolve-next-pedagogical-step-from-periodization";
import { FORBIDDEN_UI_TERMS } from "../pedagogy/volleyball-language-lexicon";

const makeWeeklyPlan = (overrides: Partial<ClassPlan> = {}): ClassPlan => ({
  id: "cp_runtime",
  classId: "class_runtime",
  cycleId: "cycle_runtime",
  startDate: "2026-02-10",
  weekNumber: 6,
  phase: "Fundamentos",
  theme: "Fundamentos com continuidade",
  technicalFocus: "continuidade com 2 ações",
  physicalFocus: "coordenação e deslocamento",
  pedagogicalRule: "usar linguagem simples",
  constraints: "",
  mvFormat: "base",
  warmupProfile: "ludico",
  jumpTarget: "baixo",
  rpeTarget: "4",
  source: "AUTO",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeSession = (date: string): WeekSessionPreview => ({
  sessionIndex: 1,
  weekday: 2,
  weekdayLabel: "Ter",
  date,
  dateLabel: "10/02/2026",
  shortLabel: "Ter 10/02",
});

const hasForbiddenTerm = (value: string) => {
  const normalized = value.toLowerCase();
  return FORBIDDEN_UI_TERMS.some((term) => normalized.includes(term.toLowerCase()));
};

describe("pedagogical runtime scenarios", () => {
  it.each([
    ["08-10", 2, "mini_2x2", "2026-02-10"],
    ["11-12", 1, "mini_3x3", "2026-01-13"],
    ["13-14", 1, "mini_4x4", "2026-01-20"],
  ] as const)(
    "generates daily plan aligned for ageBand %s",
    (ageBand, monthIndex, expectedGameForm, date) => {
      const step = resolveNextPedagogicalStepFromPeriodization({ ageBand, monthIndex });
      expect(step).not.toBeNull();
      expect(step?.gameForm).toBe(expectedGameForm);

      const daily = buildAutoDailyLessonPlan(
        makeWeeklyPlan(),
        makeSession(date),
        "2026-01-01T00:00:00.000Z",
        null,
        {
          className: `Turma ${ageBand}`,
          ageBand,
          durationMinutes: 60,
          cycleStartDate: "2026-01-01",
          cycleEndDate: "2026-12-31",
          recentPlans: [],
        }
      );

      const fullText = [daily.title, daily.warmup, daily.mainPart, daily.cooldown, daily.observations].join(" ");
      expect(daily.title).toContain("Etapa:");
      expect(daily.observations).toContain("Objetivo da aula");
      expect(hasForbiddenTerm(fullText)).toBe(false);

      const snapshot = JSON.parse(daily.generationContextSnapshotJson ?? "{}");
      expect(snapshot?.nextPedagogicalStep?.gameForm).toBe(expectedGameForm);
    }
  );
});
