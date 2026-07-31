import type { ClassGroup } from "../../../../core/models";
import { generateMonthlyBlueprint } from "../generate-monthly-blueprint";
import {
  buildInitialMonthPlans,
  regenerateWeeklyPlanFromBlueprint,
} from "../regenerate-month-plans";

const classGroup: ClassGroup = {
  id: "class-1",
  name: "Turma QA",
  organizationId: "org-1",
  unit: "Unidade",
  unitId: "unit-1",
  colorKey: "blue",
  modality: "voleibol",
  ageBand: "09-11",
  gender: "misto",
  startTime: "18:00",
  endTime: "19:00",
  durationMinutes: 60,
  daysOfWeek: [2, 4],
  daysPerWeek: 2,
  goal: "formacao",
  equipment: "quadra",
  level: 1,
  mvLevel: "2x2",
  cycleStartDate: "2026-07-06",
  cycleLengthWeeks: 8,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("buildInitialMonthPlans", () => {
  it("creates only missing weeks with sessions in an empty requested month", () => {
    const plans = buildInitialMonthPlans({
      classGroup,
      monthKey: "2026-08",
      classPlans: [],
      activeCycleId: "cycle-1",
    });

    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((plan) => plan.cycleId === "cycle-1")).toBe(true);
    expect(plans.every((plan) => plan.classId === classGroup.id)).toBe(true);
  });

  it("does not duplicate an existing week", () => {
    const initial = buildInitialMonthPlans({
      classGroup,
      monthKey: "2026-08",
      classPlans: [],
    });
    const plans = buildInitialMonthPlans({
      classGroup,
      monthKey: "2026-08",
      classPlans: [initial[0]],
    });

    expect(plans).toHaveLength(initial.length - 1);
    expect(plans.some((plan) => plan.id === initial[0].id)).toBe(false);
  });

  it("persists one operational role per real session when regenerating the month", () => {
    const existing = buildInitialMonthPlans({
      classGroup,
      monthKey: "2026-08",
      classPlans: [],
    })[0];
    expect(existing).toBeTruthy();

    const blueprint = generateMonthlyBlueprint({
      classGroup,
      monthKey: "2026-08",
    });
    const regenerated = regenerateWeeklyPlanFromBlueprint({
      existing,
      blueprint,
      cycleLength: classGroup.cycleLengthWeeks,
      classGroup,
      weeklySessions: 2,
    });
    const snapshot = JSON.parse(regenerated.generationContextSnapshotJson ?? "{}") as {
      weeklyOperationalStrategy?: {
        decisions?: Array<{ sessionIndexInWeek: number; sessionRole: string }>;
      };
    };

    expect(snapshot.weeklyOperationalStrategy?.decisions).toHaveLength(2);
    expect(snapshot.weeklyOperationalStrategy?.decisions?.map((item) => item.sessionIndexInWeek)).toEqual([1, 2]);
    expect(new Set(snapshot.weeklyOperationalStrategy?.decisions?.map((item) => item.sessionRole)).size).toBe(2);
  });
});
