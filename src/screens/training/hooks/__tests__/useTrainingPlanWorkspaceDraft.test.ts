import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import type { TrainingPlan } from "../../../../core/models";
import { useTrainingPlanWorkspaceDraft } from "../useTrainingPlanWorkspaceDraft";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const plan: TrainingPlan = {
  id: "draft-1",
  classId: "class-1",
  title: "Título digitado no PDF",
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

type DraftHook = ReturnType<typeof useTrainingPlanWorkspaceDraft>;

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("useTrainingPlanWorkspaceDraft", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("autosaves after typing and reports the saved state", async () => {
    let latest: DraftHook | null = null;
    function Harness() {
      latest = useTrainingPlanWorkspaceDraft("draft-key");
      return null;
    }

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
      await flushPromises();
    });

    act(() => {
      latest!.queueDraft(plan, "2026-08-10");
    });
    await act(async () => {
      jest.advanceTimersByTime(350);
      await flushPromises();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "draft-key",
      expect.stringContaining("Título digitado no PDF")
    );
    expect(latest!.status).toBe("saved");
  });

  it("restores a valid local draft when the workspace opens again", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({
        version: 1,
        savedAt: "2026-08-10T12:01:00.000Z",
        lessonDate: "2026-08-10",
        plan,
      })
    );
    let latest: DraftHook | null = null;
    function Harness() {
      latest = useTrainingPlanWorkspaceDraft("draft-key");
      return null;
    }

    await act(async () => {
      TestRenderer.create(React.createElement(Harness));
      await flushPromises();
    });

    expect(latest!.restoredDraft?.plan.title).toBe("Título digitado no PDF");
    expect(latest!.status).toBe("restored");
    expect(latest!.isHydrated).toBe(true);
  });

  it("waits for local storage before marking the workspace as hydrated", async () => {
    let resolveLoad: (value: string | null) => void = () => undefined;
    (AsyncStorage.getItem as jest.Mock).mockImplementation(
      () => new Promise<string | null>((resolve) => {
        resolveLoad = resolve;
      })
    );
    let latest: DraftHook | null = null;
    function Harness() {
      latest = useTrainingPlanWorkspaceDraft("draft-key");
      return null;
    }

    act(() => {
      TestRenderer.create(React.createElement(Harness));
    });
    expect(latest!.isHydrated).toBe(false);

    await act(async () => {
      resolveLoad(null);
      await flushPromises();
    });

    expect(latest!.isHydrated).toBe(true);
  });
});
