import { createTrainingPlanApplication } from "../apply-training-plan";
import { createPlanningWorkspaceDraft } from "../planning-library-bridge";

describe("apply training plan", () => {
  it("keeps persistence successful when the native calendar rejects", async () => {
    const plan = createPlanningWorkspaceDraft();
    const savePlan = jest.fn().mockResolvedValue(undefined);
    const onPendingChange = jest.fn();
    const result = await createTrainingPlanApplication().run({
      buildPlan: async () => plan, savePlan,
      createCalendarEvent: async () => { throw new Error("calendar read-only"); }, onPendingChange,
    });
    expect(result).toEqual({ plan, calendarFailed: true });
    expect(savePlan).toHaveBeenCalledTimes(1);
    expect(onPendingChange.mock.calls).toEqual([[true], [false]]);
  });

  it("rejects a repeated submit before the first version is even created", async () => {
    let resolveBuild!: (value: ReturnType<typeof createPlanningWorkspaceDraft>) => void;
    const buildPlan = jest.fn(() => new Promise<ReturnType<typeof createPlanningWorkspaceDraft>>((resolve) => { resolveBuild = resolve; }));
    const operations = { buildPlan, savePlan: jest.fn().mockResolvedValue(undefined), createCalendarEvent: jest.fn().mockResolvedValue(undefined), onPendingChange: jest.fn() };
    const application = createTrainingPlanApplication();
    const first = application.run(operations);
    expect(application.isPending()).toBe(true);
    await expect(application.run(operations)).resolves.toBeNull();
    expect(buildPlan).toHaveBeenCalledTimes(1);
    resolveBuild(createPlanningWorkspaceDraft());
    await first;
    expect(application.isPending()).toBe(false);
    expect(operations.savePlan).toHaveBeenCalledTimes(1);
  });

  it("allows retry after a failed primary write and never calls the calendar", async () => {
    const application = createTrainingPlanApplication();
    const operations = {
      buildPlan: async () => createPlanningWorkspaceDraft(),
      savePlan: jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined),
      createCalendarEvent: jest.fn().mockResolvedValue(undefined), onPendingChange: jest.fn(),
    };
    await expect(application.run(operations)).rejects.toThrow("offline");
    expect(application.isPending()).toBe(false);
    expect(operations.createCalendarEvent).not.toHaveBeenCalled();
    await expect(application.run(operations)).resolves.toMatchObject({ calendarFailed: false });
  });
});
