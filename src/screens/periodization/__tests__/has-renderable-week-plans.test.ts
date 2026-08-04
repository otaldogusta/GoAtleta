import { hasRenderableWeekPlans } from "../has-renderable-week-plans";

describe("hasRenderableWeekPlans", () => {
  it("waits for computed weeks when persisted plans hydrate first", () => {
    expect(
      hasRenderableWeekPlans({
        persistedPlanCount: 8,
        computedWeekCount: 0,
      }),
    ).toBe(false);
  });

  it("allows week rendering after both collections are available", () => {
    expect(
      hasRenderableWeekPlans({
        persistedPlanCount: 8,
        computedWeekCount: 52,
      }),
    ).toBe(true);
  });
});
