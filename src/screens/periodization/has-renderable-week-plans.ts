type RenderableWeekPlansInput = {
  persistedPlanCount: number;
  computedWeekCount: number;
};

/**
 * Saved plans can hydrate before the selected class has produced its computed
 * weeks. The screen must wait for both collections before reading a week.
 */
export const hasRenderableWeekPlans = ({
  persistedPlanCount,
  computedWeekCount,
}: RenderableWeekPlansInput) =>
  persistedPlanCount > 0 && computedWeekCount > 0;
