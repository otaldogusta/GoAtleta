import type { ClassPlan } from "../../../core/models";
import { getPlansWithinCycle } from "../hooks/useWeekPlans";

const makePlan = (weekNumber: number): ClassPlan => ({
  id: `plan-${weekNumber}`,
  classId: "class-1",
  startDate: "2026-01-05",
  weekNumber,
  phase: "Base",
  theme: "Controle de bola",
  technicalFocus: "Passe",
  physicalFocus: "Base",
  constraints: "",
  mvFormat: "6x6",
  warmupProfile: "Ativacao",
  jumpTarget: "20",
  rpeTarget: "4-5",
  source: "AUTO",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("getPlansWithinCycle", () => {
  it("ignores saved weeks outside the active cycle", () => {
    const plans = [makePlan(6), makePlan(2), makePlan(1), makePlan(8)];

    const visible = getPlansWithinCycle(plans, 5);

    expect(visible.map((plan) => plan.weekNumber)).toEqual([1, 2]);
  });

  it("keeps visible weeks ordered for month and cycle rendering", () => {
    const plans = [makePlan(4), makePlan(2), makePlan(3)];

    const visible = getPlansWithinCycle(plans, 4);

    expect(visible.map((plan) => plan.weekNumber)).toEqual([2, 3, 4]);
  });
});
