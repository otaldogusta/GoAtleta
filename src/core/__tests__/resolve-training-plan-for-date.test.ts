import type { TrainingPlan } from "../models";
import { resolveTrainingPlanForDate, trainingPlanWeekday } from "../resolve-training-plan-for-date";

const plan = (overrides: Partial<TrainingPlan>): TrainingPlan => ({
  id: "recurring", classId: "class", title: "Plano", tags: [],
  warmup: [], main: ["Jogo"], cooldown: [], warmupTime: "", mainTime: "", cooldownTime: "",
  createdAt: "2026-08-01T12:00:00Z", applyDays: [1], status: "final", ...overrides,
});

describe("selection of a training plan by civil date", () => {
  it("uses the civil weekday, including Monday and Sunday in Brazil", () => {
    expect(trainingPlanWeekday("2026-09-07")).toBe(1);
    expect(trainingPlanWeekday("2026-09-06")).toBe(7);
    expect(resolveTrainingPlanForDate([plan({})], "class", "2026-09-07")?.id).toBe("recurring");
  });

  it("never uses a plan from another date as a recurring plan", () => {
    const plans = [plan({}), plan({ id: "one-off", applyDate: "2026-08-31", version: 9 })];
    expect(resolveTrainingPlanForDate(plans, "class", "2026-09-07")?.id).toBe("recurring");
    expect(resolveTrainingPlanForDate(plans.slice(1), "class", "2026-09-07")).toBeNull();
  });

  it("prefers exact date and latest finalized version while isolating the class", () => {
    const plans = [
      plan({ version: 20 }),
      plan({ id: "exact-old", applyDate: "2026-09-07", version: 1 }),
      plan({ id: "exact", applyDate: "2026-09-07", version: 2 }),
      plan({ id: "generated", applyDate: "2026-09-07", version: 3, status: "generated" }),
      plan({ id: "other-class", classId: "other", applyDate: "2026-09-07", version: 4 }),
    ];
    expect(resolveTrainingPlanForDate(plans, "class", "2026-09-07")?.id).toBe("exact");
  });

  it.each(["2026-02-30", "invalid", "2026-9-07", "2026-09-07T00:00:00Z"])("rejects invalid civil date %s", (date) => {
    expect(trainingPlanWeekday(date)).toBeNull();
    expect(resolveTrainingPlanForDate([plan({})], "class", date)).toBeNull();
  });
});
