import { buildRotation5x1Preset } from "../../core/visual-court";
import {
  ensureDefaultRotationVisual,
  ensureDefaultVisualPresets,
  listTechnicalVisualsByClass,
  saveTechnicalVisual,
  technicalVisualRowToModel,
} from "../technical-visuals";

const mockSupabaseGet = jest.fn();
const mockSupabasePost = jest.fn();
const mockSupabasePatch = jest.fn();
const mockAsyncStorageGetItem = jest.fn();
const mockAsyncStorageSetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: unknown[]) => mockAsyncStorageGetItem(...args),
  setItem: (...args: unknown[]) => mockAsyncStorageSetItem(...args),
}));

jest.mock("../client", () => ({
  getActiveOrganizationId: jest.fn(() => Promise.resolve("org_1")),
  isAuthError: jest.fn(() => false),
  isMissingRelation: jest.fn((error: unknown, relation: string) =>
    String(error).includes(relation)
  ),
  isNetworkError: jest.fn(() => false),
  supabaseGet: (...args: unknown[]) => mockSupabaseGet(...args),
  supabasePatch: (...args: unknown[]) => mockSupabasePatch(...args),
  supabasePost: (...args: unknown[]) => mockSupabasePost(...args),
}));

describe("technical-visuals db helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseGet.mockResolvedValue([]);
    mockSupabasePost.mockResolvedValue([]);
    mockSupabasePatch.mockResolvedValue([]);
    mockAsyncStorageGetItem.mockResolvedValue(null);
    mockAsyncStorageSetItem.mockResolvedValue(undefined);
  });

  it("maps technical visual rows into court visual documents", () => {
    const payload = buildRotation5x1Preset();
    const model = technicalVisualRowToModel({
      id: "tv_1",
      organization_id: "org_1",
      class_id: "class_1",
      source_kind: "rotation",
      source_id: null,
      title: "Rodizio 5x1",
      payload_json: payload,
      created_at: "2026-06-03T10:00:00.000Z",
      updated_at: "2026-06-03T10:01:00.000Z",
    });

    expect(model.id).toBe("tv_1");
    expect(model.sourceKind).toBe("rotation");
    expect(model.payload.timeline.steps).toHaveLength(payload.timeline.steps.length);
  });

  it("returns an empty list when the technical_visuals table is absent", async () => {
    mockSupabaseGet.mockRejectedValueOnce(new Error('relation "public.technical_visuals" does not exist'));

    await expect(listTechnicalVisualsByClass("class_1")).resolves.toEqual([]);
  });

  it("lists technical visuals by canonical class and organization columns", async () => {
    await listTechnicalVisualsByClass("class_1", {
      organizationId: "org_1",
      limit: 4,
    });

    expect(mockSupabaseGet).toHaveBeenCalledWith(
      "/technical_visuals?select=*&class_id=eq.class_1&organization_id=eq.org_1&order=updated_at.desc&limit=4"
    );
  });

  it("posts a new technical visual with normalized payload json", async () => {
    const saved = await saveTechnicalVisual({
      organizationId: "org_1",
      classId: "class_1",
      sourceKind: "rotation",
      title: "Rodizio 5x1 basico",
      payload: buildRotation5x1Preset(),
    });

    expect(saved?.classId).toBe("class_1");
    expect(mockSupabasePost).toHaveBeenCalledTimes(1);
    const [path, rows, headers] = mockSupabasePost.mock.calls[0];
    expect(path).toBe("/technical_visuals?on_conflict=id");
    expect(headers).toEqual({ Prefer: "resolution=merge-duplicates" });
    expect(rows[0].payload_json.version).toBe(1);
    expect(rows[0].payload_json.timeline.steps).toHaveLength(12);
    expect(rows[0].class_id).toBe("class_1");
    expect(rows[0].created_at).toBeTruthy();
    expect(rows[0].updated_at).toBeTruthy();
  });

  it("saves locally when the technical_visuals table is not applied yet", async () => {
    mockSupabasePost.mockRejectedValueOnce(new Error("technical_visuals missing"));

    const result = await saveTechnicalVisual({
      organizationId: "org_1",
      classId: "class_1",
      sourceKind: "rotation",
      title: "Rodizio 5x1 basico",
      payload: buildRotation5x1Preset(),
    });

    expect(result?.id).toMatch(/^local_/);
    expect(mockAsyncStorageSetItem).toHaveBeenCalledTimes(1);
  });

  it("preserves an existing saved rotation instead of replacing it with the default preset", async () => {
    const oldPayload = {
      ...buildRotation5x1Preset(),
      court: {
        orientation: "vertical" as const,
        showZones: true,
        layoutMode: "official_zones" as const,
        labelMode: "official_zones" as const,
      },
    };
    const oldRow = {
      id: "tv_old",
      organization_id: "org_1",
      class_id: "class_1",
      source_kind: "rotation",
      source_id: null,
      title: "Rodizio 5x1 basico",
      payload_json: oldPayload,
      created_at: "2026-06-03T10:00:00.000Z",
      updated_at: "2026-06-03T10:00:00.000Z",
    };
    mockSupabaseGet.mockResolvedValueOnce([oldRow]);

    const result = await ensureDefaultRotationVisual({
      classId: "class_1",
      organizationId: "org_1",
    });

    expect(result?.id).toBe("tv_old");
    expect(result?.payload.court.layoutMode).toBe("official_zones");
    expect(result?.title).toBe("Rodizio 5x1 basico");
    expect(mockSupabasePatch).not.toHaveBeenCalled();
    expect(mockSupabasePost).not.toHaveBeenCalled();
  });

  it("does not overwrite an existing default preset that was manually edited", async () => {
    const editedPayload = buildRotation5x1Preset();
    editedPayload.timeline.steps[0].actorPositions.p1 = { x: 0.33, y: 0.77 };
    const savedReceiveRow = {
      id: "tv_receive",
      organization_id: "org_1",
      class_id: "class_1",
      source_kind: "rotation",
      source_id: "5x1_receive_3",
      title: "5x1 base - recepção em 3",
      payload_json: editedPayload,
      created_at: "2026-06-03T10:00:00.000Z",
      updated_at: "2026-06-03T10:02:00.000Z",
    };
    mockSupabaseGet.mockResolvedValueOnce([savedReceiveRow]);

    const result = await ensureDefaultVisualPresets({
      classId: "class_1",
      organizationId: "org_1",
    });

    expect(result[0].id).toBe("tv_receive");
    expect(result[0].payload.timeline.steps[0].actorPositions.p1).toEqual({
      x: 0.33,
      y: 0.77,
    });
    expect(mockSupabasePatch).not.toHaveBeenCalled();
    expect(mockSupabasePost).toHaveBeenCalledTimes(3);
  });

  it("ensures receive, serving, defense and didactic default presets", async () => {
    const result = await ensureDefaultVisualPresets({
      classId: "class_1",
      organizationId: "org_1",
    });

    expect(result.map((item) => item.title)).toEqual([
      "5x1 base - recepção em 3",
      "5x1 base - equipe sacando",
      "Defesa base — 6 fundo",
      "Grade didática",
    ]);
    expect(mockSupabasePost).toHaveBeenCalledTimes(4);
  });
});
