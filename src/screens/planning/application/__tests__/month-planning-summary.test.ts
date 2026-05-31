import type { ClassGroup, ClassPlan, PlanningCycle } from "../../../../core/models";
import { buildMonthPlanningSummaries } from "../month-planning-summary";

const baseClass = {
  id: "class_1",
  daysOfWeek: [1, 3],
  daysPerWeek: 2,
} as ClassGroup;

const cycle2026 = {
  id: "cycle_2026",
  classId: "class_1",
  year: 2026,
  title: "Jan-Dez 2026",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as PlanningCycle;

const plan = (id: string, startDate: string, weekNumber: number, weeklySessions?: number) =>
  ({
    id,
    classId: "class_1",
    startDate,
    weekNumber,
    phase: "desenvolvimento",
    theme: "Tomada de decisão",
    technicalFocus: "toque e manchete",
    physicalFocus: "coordenação",
    constraints: "",
    mvFormat: "",
    warmupProfile: "",
    jumpTarget: "",
    rpeTarget: "",
    source: "AUTO",
    weeklySessions,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }) as ClassPlan;

describe("buildMonthPlanningSummaries", () => {
  it("mantém o ciclo em ordem de janeiro a dezembro e preserva meses sem planejamento", () => {
    const summaries = buildMonthPlanningSummaries(
      [
        plan("dec_1", "2026-12-07", 35),
        plan("mar_1", "2026-03-02", 9),
      ],
      baseClass,
      cycle2026
    );

    expect(summaries).toHaveLength(12);
    expect(summaries.map((item) => item.monthKey)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
    expect(summaries.find((item) => item.monthKey === "2026-04")).toMatchObject({
      hasPlans: false,
      weekCount: 0,
      estimatedLessonCount: 0,
    });
    expect(summaries.find((item) => item.monthKey === "2026-12")).toMatchObject({
      hasPlans: true,
      weekCount: 1,
      estimatedLessonCount: 2,
    });
  });

  it("ordena cronologicamente mesmo quando não há ciclo ativo", () => {
    const summaries = buildMonthPlanningSummaries(
      [
        plan("dec_1", "2026-12-07", 35, 2),
        plan("aug_1", "2026-08-03", 19, 3),
      ],
      null,
      null
    );

    expect(summaries.map((item) => item.monthKey)).toEqual(["2026-08", "2026-12"]);
    expect(summaries[0].estimatedLessonCount).toBe(3);
  });
});
