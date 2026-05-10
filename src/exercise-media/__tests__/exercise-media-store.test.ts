import {
  approveExerciseMediaAsset,
  listApprovedMediaAssets,
} from "../exercise-media-approval";
import {
  createInMemoryExerciseMediaStore,
  setExerciseMediaStore,
} from "../exercise-media-store";
import {
  getExerciseMediaAssetById,
  listExerciseMediaAssets,
  registerExerciseMediaAsset,
  resetExerciseMediaRegistry,
  updateExerciseMediaAsset,
} from "../exercise-media-registry";
import { InMemoryExerciseMediaStore } from "../stores/in-memory-exercise-media-store";
import type { ExerciseMediaAsset } from "../exercise-media.types";

function buildAsset(
  id: string,
  status: ExerciseMediaAsset["status"] = "draft",
): ExerciseMediaAsset {
  return {
    id,
    exerciseKey: "stiff",
    title: "Stiff",
    kind: "video",
    source: "higgsfield",
    status,
    uri: `https://example.com/${id}.mp4`,
    createdAt: "2026-05-08T00:00:00.000Z",
  };
}

describe("InMemoryExerciseMediaStore", () => {
  afterEach(() => {
    setExerciseMediaStore(createInMemoryExerciseMediaStore());
    resetExerciseMediaRegistry();
  });

  it("lists assets", () => {
    const store = new InMemoryExerciseMediaStore([buildAsset("draft-1")]);

    expect(store.list()).toHaveLength(1);
    expect(store.list()[0].id).toBe("draft-1");
  });

  it("upsert creates assets", () => {
    const store = new InMemoryExerciseMediaStore();
    store.upsert(buildAsset("draft-1"));

    expect(store.list()).toHaveLength(1);
  });

  it("upsert updates assets", () => {
    const store = new InMemoryExerciseMediaStore([buildAsset("draft-1")]);

    const updated = store.upsert({
      ...buildAsset("draft-1"),
      title: "Stiff atualizado",
    });

    expect(updated.title).toBe("Stiff atualizado");
    expect(store.getById("draft-1")?.title).toBe("Stiff atualizado");
  });

  it("upsert does not downgrade approved to draft", () => {
    const store = new InMemoryExerciseMediaStore([buildAsset("asset-1", "approved")]);

    const result = store.upsert(buildAsset("asset-1", "draft"));

    expect(result.status).toBe("approved");
    expect(store.getById("asset-1")?.status).toBe("approved");
  });

  it("getById works", () => {
    const store = new InMemoryExerciseMediaStore([buildAsset("draft-1")]);

    expect(store.getById("draft-1")?.id).toBe("draft-1");
    expect(store.getById("missing")).toBeNull();
  });

  it("update works", () => {
    const store = new InMemoryExerciseMediaStore([buildAsset("draft-1")]);

    const updated = store.update("draft-1", (asset) => ({
      ...asset,
      status: "approved",
    }));

    expect(updated?.status).toBe("approved");
  });

  it("update missing returns null", () => {
    const store = new InMemoryExerciseMediaStore();

    expect(
      store.update("missing", (asset) => ({
        ...asset,
        title: "nunca",
      })),
    ).toBeNull();
  });

  it("reset clears back to initial assets", () => {
    const store = new InMemoryExerciseMediaStore([buildAsset("seed-1")]);
    store.upsert(buildAsset("draft-1"));

    store.reset();

    expect(store.list().map((asset) => asset.id)).toEqual(["seed-1"]);
  });

  it("registry keeps using the store facade", () => {
    const store = new InMemoryExerciseMediaStore();
    setExerciseMediaStore(store);

    registerExerciseMediaAsset(buildAsset("draft-1"));

    expect(listExerciseMediaAssets()).toHaveLength(1);
    expect(getExerciseMediaAssetById("draft-1")?.id).toBe("draft-1");
  });

  it("approval service keeps working through the store-backed registry", async () => {
    const store = new InMemoryExerciseMediaStore();
    setExerciseMediaStore(store);

    registerExerciseMediaAsset(buildAsset("draft-1"));
    await approveExerciseMediaAsset("draft-1");

    expect(listApprovedMediaAssets().map((asset) => asset.id)).toEqual(["draft-1"]);
  });

  it("registry update works through the store facade", () => {
    const store = new InMemoryExerciseMediaStore();
    setExerciseMediaStore(store);

    registerExerciseMediaAsset(buildAsset("draft-1"));
    updateExerciseMediaAsset("draft-1", (asset) => ({
      ...asset,
      title: "Stiff 2",
    }));

    expect(getExerciseMediaAssetById("draft-1")?.title).toBe("Stiff 2");
  });
});
