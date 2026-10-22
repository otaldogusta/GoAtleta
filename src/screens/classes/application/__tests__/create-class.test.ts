import { createClassAndRefresh } from "../create-class";

describe("class creation and list refresh", () => {
  it.each(["permission denied", "Failed to fetch"])("propagates a write failure (%s) without refreshing or reporting success", async (message) => {
    const error = new Error(message);
    const save = jest.fn().mockRejectedValue(error);
    const refresh = jest.fn();
    await expect(createClassAndRefresh({ save, refresh })).rejects.toBe(error);
    expect(save).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns the persisted class even if the list refresh fails, without repeating the write", async () => {
    const save = jest.fn().mockResolvedValue("class-1");
    const refresh = jest.fn().mockRejectedValue(new Error("Failed to fetch"));
    await expect(createClassAndRefresh({ save, refresh })).resolves.toEqual({ classId: "class-1", refreshFailed: true });
    expect(save).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes only after the class has been saved", async () => {
    const events: string[] = [];
    await expect(createClassAndRefresh({
      save: async () => { events.push("saved"); return "class-1"; },
      refresh: async () => { events.push("refreshed"); },
    })).resolves.toEqual({ classId: "class-1", refreshFailed: false });
    expect(events).toEqual(["saved", "refreshed"]);
  });
});
