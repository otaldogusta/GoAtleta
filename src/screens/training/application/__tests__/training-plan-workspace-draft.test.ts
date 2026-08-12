import AsyncStorage from "@react-native-async-storage/async-storage";

import type { TrainingPlan } from "../../../../core/models";
import {
  buildTrainingPlanWorkspaceDraftKey,
  clearTrainingPlanWorkspaceDraft,
  loadTrainingPlanWorkspaceLibrary,
  loadTrainingPlanWorkspaceDraft,
  removeTrainingPlanWorkspaceLibraryItem,
  saveTrainingPlanWorkspaceDraft,
  upsertTrainingPlanWorkspaceLibrary,
} from "../training-plan-workspace-draft";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const plan: TrainingPlan = {
  id: "draft-1",
  classId: "class-1",
  title: "Plano em edição",
  tags: [],
  warmup: [],
  main: [],
  cooldown: [],
  warmupTime: "",
  mainTime: "",
  cooldownTime: "",
  createdAt: "2026-08-10T12:00:00.000Z",
  origin: "manual",
};

describe("training plan workspace draft", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("scopes the draft by user and organization", () => {
    expect(
      buildTrainingPlanWorkspaceDraftKey({ userId: "user-1", organizationId: "org-1" })
    ).toBe("@goatleta/training-plan-workspace-draft/v1/user-1/org-1");
    expect(buildTrainingPlanWorkspaceDraftKey({ userId: "", organizationId: "org-1" })).toBeNull();
  });

  it("saves and restores the complete editable plan", async () => {
    const key = buildTrainingPlanWorkspaceDraftKey({ userId: "user-1", organizationId: "org-1" });
    await saveTrainingPlanWorkspaceDraft(key, plan, "2026-08-10");
    const serialized = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1] as string;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(serialized);

    await expect(loadTrainingPlanWorkspaceDraft(key)).resolves.toMatchObject({
      version: 1,
      lessonDate: "2026-08-10",
      plan,
    });
  });

  it("ignores invalid payloads and clears a confirmed save", async () => {
    const key = buildTrainingPlanWorkspaceDraftKey({ userId: "user-1", organizationId: "org-1" });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{"version":1,"plan":{}}');
    await expect(loadTrainingPlanWorkspaceDraft(key)).resolves.toBeNull();

    await clearTrainingPlanWorkspaceDraft(key);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(key);
  });

  it("keeps every imported unassigned page in the local planning library", async () => {
    const key = buildTrainingPlanWorkspaceDraftKey({ userId: "user-1", organizationId: "org-1" });
    const imported = [
      { ...plan, id: "pdf-page-1", classId: "", title: "Plano 1" },
      { ...plan, id: "pdf-page-2", classId: "", title: "Plano 2" },
    ];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    await upsertTrainingPlanWorkspaceLibrary(key, imported);
    const serialized = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1] as string;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(serialized);

    await expect(loadTrainingPlanWorkspaceLibrary(key)).resolves.toMatchObject(imported);

    await removeTrainingPlanWorkspaceLibraryItem(key, "pdf-page-1");
    const updated = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)?.[1] as string);
    expect(updated.plans.map((item: TrainingPlan) => item.id)).toEqual(["pdf-page-2"]);
  });
});
