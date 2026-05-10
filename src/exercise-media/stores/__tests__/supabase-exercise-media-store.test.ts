jest.mock("../../../db/client", () => ({
  supabaseGet: jest.fn(),
  supabasePost: jest.fn(),
}));

import { supabaseGet, supabasePost } from "../../../db/client";
import type { ExerciseMediaAsset } from "../../exercise-media.types";
import {
  fromExerciseMediaAssetRow,
  toExerciseMediaAssetRow,
} from "../supabase-exercise-media-mappers";
import { SupabaseExerciseMediaStore } from "../supabase-exercise-media-store";

const mockSupabaseGet = supabaseGet as jest.MockedFunction<typeof supabaseGet>;
const mockSupabasePost = supabasePost as jest.MockedFunction<typeof supabasePost>;

function buildAsset(
  overrides: Partial<ExerciseMediaAsset> = {},
): ExerciseMediaAsset {
  return {
    id: overrides.id ?? "asset-1",
    exerciseKey: overrides.exerciseKey ?? "stiff",
    title: overrides.title ?? "Stiff",
    kind: overrides.kind ?? "video",
    source: overrides.source ?? "higgsfield",
    status: overrides.status ?? "draft",
    uri: overrides.uri ?? "https://example.com/stiff.mp4",
    thumbnailUri: overrides.thumbnailUri,
    qrUri: overrides.qrUri,
    tags: overrides.tags ?? ["academia"],
    createdAt: overrides.createdAt ?? "2026-05-08T00:00:00.000Z",
    updatedAt: overrides.updatedAt,
    approvedBy: overrides.approvedBy,
    approvalNote: overrides.approvalNote,
    approvedAt: overrides.approvedAt,
    archivedBy: overrides.archivedBy,
    archiveNote: overrides.archiveNote,
    archivedAt: overrides.archivedAt,
  };
}

describe("SupabaseExerciseMediaStore mappers", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("maps camelCase to snake_case", () => {
    const row = toExerciseMediaAssetRow(
      buildAsset({
        thumbnailUri: "https://example.com/thumb.png",
        qrUri: "https://example.com/qr.png",
      }),
    );

    expect(row.exercise_key).toBe("stiff");
    expect(row.thumbnail_uri).toBe("https://example.com/thumb.png");
    expect(row.qr_uri).toBe("https://example.com/qr.png");
    expect(row.tags).toEqual(["academia"]);
  });

  it("maps snake_case to camelCase", () => {
    const asset = fromExerciseMediaAssetRow({
      id: "asset-1",
      organization_id: null,
      exercise_key: "stiff",
      title: "Stiff",
      kind: "video",
      source: "higgsfield",
      status: "draft",
      uri: "https://example.com/stiff.mp4",
      thumbnail_uri: "https://example.com/thumb.png",
      qr_uri: null,
      modality: null,
      sport: null,
      age_band: null,
      level: null,
      tags: ["academia"],
      approved_by: null,
      approval_note: null,
      approved_at: null,
      archived_by: null,
      archive_note: null,
      archived_at: null,
      created_at: "2026-05-08T00:00:00.000Z",
      updated_at: null,
    });

    expect(asset.exerciseKey).toBe("stiff");
    expect(asset.thumbnailUri).toBe("https://example.com/thumb.png");
    expect(asset.tags).toEqual(["academia"]);
  });

  it("keeps tags empty as array", () => {
    const asset = fromExerciseMediaAssetRow({
      id: "asset-1",
      organization_id: null,
      exercise_key: "stiff",
      title: "Stiff",
      kind: "video",
      source: "higgsfield",
      status: "draft",
      uri: "https://example.com/stiff.mp4",
      thumbnail_uri: null,
      qr_uri: null,
      modality: null,
      sport: null,
      age_band: null,
      level: null,
      tags: null,
      approved_by: null,
      approval_note: null,
      approved_at: null,
      archived_by: null,
      archive_note: null,
      archived_at: null,
      created_at: "2026-05-08T00:00:00.000Z",
      updated_at: null,
    } as any);

    expect(asset.tags).toEqual([]);
  });

  it("maps approved and archived fields", () => {
    const row = toExerciseMediaAssetRow(
      buildAsset({
        status: "approved",
        approvedBy: "trainer-1",
        approvalNote: "validado",
        approvedAt: "2026-05-08T10:00:00.000Z",
        archivedBy: "trainer-2",
        archiveNote: "legado",
        archivedAt: "2026-05-09T10:00:00.000Z",
      }),
    );

    expect(row.approved_by).toBe("trainer-1");
    expect(row.archive_note).toBe("legado");
  });
});

describe("SupabaseExerciseMediaStore", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("reset does not delete cached assets or remote data", () => {
    const store = new SupabaseExerciseMediaStore();
    store.upsert(buildAsset());

    store.reset();

    expect(store.list()).toHaveLength(1);
    expect(mockSupabasePost).not.toHaveBeenCalled();
  });

  it("hydrate loads rows into cache", async () => {
    mockSupabaseGet.mockResolvedValueOnce([
      toExerciseMediaAssetRow(buildAsset()),
    ] as any);

    const store = new SupabaseExerciseMediaStore();
    await store.hydrate();

    expect(store.list()).toHaveLength(1);
    expect(store.list()[0].exerciseKey).toBe("stiff");
  });

  it("persistUpsert preserves approved over draft", async () => {
    const store = new SupabaseExerciseMediaStore();
    store.upsert(buildAsset({ id: "asset-1", status: "approved", source: "manual" }));

    const result = await store.persistUpsert(
      buildAsset({ id: "asset-1", status: "draft" }),
    );

    expect(result.status).toBe("approved");
    expect(mockSupabasePost).not.toHaveBeenCalled();
  });

  it("persistUpsert writes and refreshes cache", async () => {
    mockSupabasePost.mockResolvedValueOnce([
      toExerciseMediaAssetRow(buildAsset({ title: "Stiff atualizado" })),
    ] as any);

    const store = new SupabaseExerciseMediaStore();
    const result = await store.persistUpsert(
      buildAsset({ title: "Stiff atualizado" }),
    );

    expect(result.title).toBe("Stiff atualizado");
    expect(store.getById("asset-1")?.title).toBe("Stiff atualizado");
  });
});
