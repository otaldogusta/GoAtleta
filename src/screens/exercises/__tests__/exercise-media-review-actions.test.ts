import {
  listApprovedMediaAssets,
  listDraftMediaAssets,
} from "../../../exercise-media/exercise-media-approval";
import {
  registerExerciseMediaAsset,
  resetExerciseMediaRegistry,
} from "../../../exercise-media/exercise-media-registry";
import {
  approveExerciseMediaReviewAsset,
  archiveExerciseMediaReviewAsset,
} from "../exercise-media-review-actions";

describe("exercise media review actions", () => {
  beforeEach(() => {
    resetExerciseMediaRegistry();
  });

  it("aprova draft e move para a lista de aprovadas", async () => {
    registerExerciseMediaAsset({
      id: "draft-1",
      exerciseKey: "stiff",
      title: "Stiff",
      kind: "video",
      source: "higgsfield",
      status: "draft",
      uri: "https://example.com/stiff.mp4",
      createdAt: new Date().toISOString(),
    });

    await approveExerciseMediaReviewAsset("draft-1");

    expect(listDraftMediaAssets()).toHaveLength(0);
    expect(listApprovedMediaAssets()).toHaveLength(1);
  });

  it("arquiva draft e remove da lista de pendentes", async () => {
    registerExerciseMediaAsset({
      id: "draft-2",
      exerciseKey: "agachamento",
      title: "Agachamento",
      kind: "video",
      source: "higgsfield",
      status: "draft",
      uri: "https://example.com/agachamento.mp4",
      createdAt: new Date().toISOString(),
    });

    await archiveExerciseMediaReviewAsset("draft-2");

    expect(listDraftMediaAssets()).toHaveLength(0);
  });

  it("arquiva approved e remove da lista de aprovadas", async () => {
    registerExerciseMediaAsset({
      id: "approved-1",
      exerciseKey: "core-anti-rotacao",
      title: "Core anti-rotação",
      kind: "video",
      source: "higgsfield",
      status: "approved",
      uri: "https://example.com/core.mp4",
      createdAt: new Date().toISOString(),
    });

    await archiveExerciseMediaReviewAsset("approved-1");

    expect(listApprovedMediaAssets()).toHaveLength(0);
  });
});
