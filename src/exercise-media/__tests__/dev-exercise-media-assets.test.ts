import { bootstrapDevExerciseMedia } from "../bootstrap-dev-exercise-media";
import {
  devExerciseMediaAssets,
  registerDevExerciseMediaAssets,
} from "../dev-exercise-media-assets";
import {
  listExerciseMediaAssets,
  resetExerciseMediaRegistry,
} from "../exercise-media-registry";
import { resolveExerciseMedia } from "../resolve-exercise-media";

describe("devExerciseMediaAssets", () => {
  beforeEach(() => {
    resetExerciseMediaRegistry();
  });

  it("keeps all dev assets as approved", () => {
    expect(devExerciseMediaAssets).toHaveLength(3);
    expect(devExerciseMediaAssets.every((asset) => asset.status === "approved")).toBe(true);
  });

  it("registers dev assets without duplication", () => {
    registerDevExerciseMediaAssets();
    registerDevExerciseMediaAssets();

    const assets = listExerciseMediaAssets();
    expect(assets).toHaveLength(devExerciseMediaAssets.length);
    expect(new Set(assets.map((asset) => asset.id)).size).toBe(devExerciseMediaAssets.length);
  });

  it("does not register anything when bootstrap is disabled", () => {
    bootstrapDevExerciseMedia();
    expect(listExerciseMediaAssets()).toEqual([]);
  });

  it("registers dev assets when bootstrap is enabled", () => {
    bootstrapDevExerciseMedia({ enabled: true });
    expect(listExerciseMediaAssets()).toHaveLength(devExerciseMediaAssets.length);
  });

  it("resolves stiff after bootstrap is enabled", () => {
    bootstrapDevExerciseMedia({ enabled: true });

    const result = resolveExerciseMedia({
      exerciseName: "stiff",
      preferredKind: "video",
    });

    expect(result.reason).toBe("exact_match");
    expect(result.asset?.id).toBe("dev-stiff-video");
    expect(result.asset?.uri).toBe("https://example.com/stiff-demo.mp4");
  });
});
