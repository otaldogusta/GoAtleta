import { summarizeClassPlanActivities } from "../class-plan-block-presentation";

describe("summarizeClassPlanActivities", () => {
  it("shows at most two activities and reports the remaining count", () => {
    const summary = summarizeClassPlanActivities(["Caça bola", "Pega-pega", "Passe", "Saque", "Jogo"]);

    expect(summary.visibleActivities).toEqual(["Caça bola", "Pega-pega"]);
    expect(summary.remainingCount).toBe(3);
  });

  it("does not report a remainder when there are two activities or fewer", () => {
    expect(summarizeClassPlanActivities(["Caça bola", "Pega-pega"]).remainingCount).toBe(0);
    expect(summarizeClassPlanActivities([]).remainingCount).toBe(0);
  });
});
