import { resetExerciseMediaStoreBootstrapForTests } from "../bootstrap-exercise-media-store";
import { listExerciseMediaAssets, resetExerciseMediaRegistry } from "../exercise-media-registry";
import { bootstrapExerciseMediaRuntime } from "../bootstrap-exercise-media-runtime";

describe("bootstrapExerciseMediaRuntime", () => {
  beforeEach(() => {
    resetExerciseMediaStoreBootstrapForTests();
    resetExerciseMediaRegistry();
  });

  it("does not register assets when runtime is not in dev mode", async () => {
    await bootstrapExerciseMediaRuntime({ isDev: false });

    expect(listExerciseMediaAssets()).toEqual([]);
  });

  it("registers dev assets when runtime is in dev mode", async () => {
    await bootstrapExerciseMediaRuntime({ isDev: true });

    expect(listExerciseMediaAssets().length).toBeGreaterThan(0);
  });

  it("stays idempotent across multiple bootstraps", async () => {
    await bootstrapExerciseMediaRuntime({ isDev: true });
    await bootstrapExerciseMediaRuntime({ isDev: true });

    const assets = listExerciseMediaAssets();
    expect(new Set(assets.map((asset) => asset.id)).size).toBe(assets.length);
  });
});
