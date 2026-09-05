import type { TrainingPlan } from "../../../core/models";

type ApplyTrainingPlanOperations = {
  buildPlan: () => Promise<TrainingPlan>;
  savePlan: (plan: TrainingPlan) => Promise<unknown>;
  createCalendarEvent: (plan: TrainingPlan) => Promise<unknown>;
  onPendingChange: (pending: boolean) => void;
};

/** One submission owns version creation and persistence until completion. */
export function createTrainingPlanApplication() {
  let pending = false;
  return {
    isPending: () => pending,
    async run(operations: ApplyTrainingPlanOperations) {
      if (pending) return null;
      pending = true;
      operations.onPendingChange(true);
      try {
        const plan = await operations.buildPlan();
        await operations.savePlan(plan);
        let calendarFailed = false;
        try {
          await operations.createCalendarEvent(plan);
        } catch {
          // Calendar is a secondary integration. The saved plan remains successful.
          calendarFailed = true;
        }
        return { plan, calendarFailed };
      } finally {
        pending = false;
        operations.onPendingChange(false);
      }
    },
  };
}
