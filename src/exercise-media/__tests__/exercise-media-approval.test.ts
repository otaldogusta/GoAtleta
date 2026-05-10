import {
  approveExerciseMediaAsset,
  archiveExerciseMediaAsset,
  getExerciseMediaAssetById,
  listApprovedMediaAssets,
  listArchivedMediaAssets,
  listDraftMediaAssets,
  rejectExerciseMediaAsset,
} from "../exercise-media-approval";
import {
  registerExerciseMediaAsset,
  resetExerciseMediaRegistry,
} from "../exercise-media-registry";
import { resolveExerciseMedia } from "../resolve-exercise-media";
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

describe("exercise media approval", () => {
  beforeEach(() => {
    resetExerciseMediaRegistry();
  });

  it("lists only drafts", () => {
    registerExerciseMediaAsset(buildAsset("draft-1", "draft"));
    registerExerciseMediaAsset(buildAsset("approved-1", "approved"));
    registerExerciseMediaAsset(buildAsset("archived-1", "archived"));

    expect(listDraftMediaAssets().map((asset) => asset.id)).toEqual(["draft-1"]);
  });

  it("approves draft assets", async () => {
    registerExerciseMediaAsset(buildAsset("draft-1", "draft"));

    const approved = await approveExerciseMediaAsset("draft-1");

    expect(approved?.status).toBe("approved");
    expect(listApprovedMediaAssets().map((asset) => asset.id)).toEqual(["draft-1"]);
  });

  it("approved assets become visible to resolveExerciseMedia", async () => {
    registerExerciseMediaAsset(buildAsset("draft-1", "draft"));
    await approveExerciseMediaAsset("draft-1");

    const result = resolveExerciseMedia({
      exerciseName: "Stiff",
      preferredKind: "video",
    });

    expect(result.asset?.id).toBe("draft-1");
    expect(result.reason).toBe("exact_match");
  });

  it("does not approve archived assets", async () => {
    registerExerciseMediaAsset(buildAsset("archived-1", "archived"));

    await expect(approveExerciseMediaAsset("archived-1")).resolves.toBeNull();
  });

  it("returns null when approving missing assets", async () => {
    await expect(approveExerciseMediaAsset("missing")).resolves.toBeNull();
  });

  it("is idempotent when approving approved assets", async () => {
    registerExerciseMediaAsset(buildAsset("approved-1", "approved"));

    const approved = await approveExerciseMediaAsset("approved-1");
    expect(approved?.status).toBe("approved");
  });

  it("archives draft assets", async () => {
    registerExerciseMediaAsset(buildAsset("draft-1", "draft"));

    const archived = await archiveExerciseMediaAsset("draft-1");
    expect(archived?.status).toBe("archived");
    expect(listArchivedMediaAssets().map((asset) => asset.id)).toEqual(["draft-1"]);
  });

  it("archives approved assets", async () => {
    registerExerciseMediaAsset(buildAsset("approved-1", "approved"));

    const archived = await archiveExerciseMediaAsset("approved-1");
    expect(archived?.status).toBe("archived");
  });

  it("archived assets do not appear in resolveExerciseMedia", async () => {
    registerExerciseMediaAsset(buildAsset("approved-1", "approved"));
    await archiveExerciseMediaAsset("approved-1");

    const result = resolveExerciseMedia({
      exerciseName: "Stiff",
      preferredKind: "video",
    });

    expect(result.asset).toBeNull();
    expect(result.reason).toBe("not_found");
  });

  it("reject aliases archive", async () => {
    registerExerciseMediaAsset(buildAsset("draft-1", "draft"));

    const rejected = await rejectExerciseMediaAsset("draft-1");
    expect(rejected?.status).toBe("archived");
  });

  it("fills approvedBy and approvedAt when provided", async () => {
    registerExerciseMediaAsset(buildAsset("draft-1", "draft"));

    const approved = await approveExerciseMediaAsset("draft-1", {
      by: "prof-1",
      note: "Validado para uso",
      at: "2026-05-08T10:00:00.000Z",
    });

    expect(approved?.approvedBy).toBe("prof-1");
    expect(approved?.approvalNote).toBe("Validado para uso");
    expect(approved?.approvedAt).toBe("2026-05-08T10:00:00.000Z");
  });

  it("keeps getExerciseMediaAssetById working with approval updates", async () => {
    registerExerciseMediaAsset(buildAsset("draft-1", "draft"));
    await approveExerciseMediaAsset("draft-1");

    expect(getExerciseMediaAssetById("draft-1")?.status).toBe("approved");
  });
});
