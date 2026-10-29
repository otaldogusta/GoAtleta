import {
  buildDefenseBase6BackPreset,
  buildRotation5x1Preset,
  updateCourtVisualStepActorStaticPosition,
} from "../../core/visual-court";
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
const mockActiveOrganization = jest.fn();
const mockIsAuthError = jest.fn();
const mockIsNetworkError = jest.fn();
let mockUserId = "user_1";
let mockIdentityGeneration = 0;
let mockCacheGeneration = 0;

jest.mock("../../auth/session", () => ({
  getSessionIdentity: () => ({ userId: mockUserId, generation: mockIdentityGeneration }),
  assertSessionIdentity: (identity: { userId: string; generation: number }) => {
    if (identity.userId !== mockUserId || identity.generation !== mockIdentityGeneration) {
      throw new Error("A sessão mudou. Abra novamente esta operação.");
    }
  },
  SessionIdentityChangedError: class extends Error {
    constructor() { super("A sessão mudou. Abra novamente esta operação."); }
  },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: unknown[]) => mockAsyncStorageGetItem(...args),
  setItem: (...args: unknown[]) => mockAsyncStorageSetItem(...args),
}));

jest.mock("../client", () => ({
  getActiveOrganizationId: () => mockActiveOrganization(),
  getReadCacheGeneration: () => mockCacheGeneration,
  isAuthError: (...args: unknown[]) => mockIsAuthError(...args),
  isMissingRelation: jest.fn((error: unknown, relation: string) =>
    String(error).includes(relation)
  ),
  isNetworkError: (...args: unknown[]) => mockIsNetworkError(...args),
  supabaseGet: (...args: unknown[]) => mockSupabaseGet(...args),
  supabasePatch: (...args: unknown[]) => mockSupabasePatch(...args),
  supabasePost: (...args: unknown[]) => mockSupabasePost(...args),
}));

describe("technical-visuals db helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = "user_1"; mockIdentityGeneration = 0; mockCacheGeneration = 0;
    mockActiveOrganization.mockResolvedValue("org_1");
    mockIsAuthError.mockReturnValue(false); mockIsNetworkError.mockReturnValue(false);
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

  it("preserves manually edited defense positions instead of normalizing them on save", async () => {
    const preset = buildDefenseBase6BackPreset();
    const targetIndex = preset.timeline.steps.findIndex(
      (step) =>
        step.rotationIndex === 3 &&
        step.attackOrigin === "middle" &&
        step.defenseKind === "short_tip"
    );
    const editedPayload = updateCourtVisualStepActorStaticPosition(
      preset,
      targetIndex,
      "lib",
      { x: 0.21, y: 0.73 }
    );

    await saveTechnicalVisual({
      organizationId: "org_1",
      classId: "class_1",
      sourceKind: "rotation",
      sourceId: "defense_base_6_back",
      title: "Defesa base — 6 fundo",
      payload: editedPayload,
    });

    const [, rows] = mockSupabasePost.mock.calls[0];
    expect(rows[0].payload_json.timeline.steps[targetIndex].actorPositions.lib).toEqual({
      x: 0.21,
      y: 0.73,
    });
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

  it.each(["network", "auth", "missing-table"])("does not report a remote autosave success after a %s failure", async kind => {
    const failure = new Error(kind === "missing-table" ? "technical_visuals missing" : kind);
    mockIsNetworkError.mockReturnValue(kind === "network");
    mockIsAuthError.mockReturnValue(kind === "auth");
    mockSupabasePost.mockRejectedValueOnce(failure);
    await expect(saveTechnicalVisual({
      id: "tv_autosave", organizationId: "org_1", classId: "class_1", sourceKind: "free",
      title: "Jogada", payload: buildRotation5x1Preset(),
    }, { requireRemote: true })).rejects.toBe(failure);
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
    expect(mockSupabasePost.mock.calls[0][3]).toEqual({ userId: "user_1", generation: 0 });
  });

  it("confirms remote autosave with one atomic upsert and preserves the original creation timestamp", async () => {
    const input = {
      id: "tv_autosave", organizationId: "org_1", classId: "class_1", sourceKind: "free" as const,
      title: "Jogada", payload: buildRotation5x1Preset(),
    };
    const createdAt = "2026-06-03T10:00:00.000Z";
    mockSupabasePost.mockImplementationOnce(async (_path, rows) => [{ ...rows[0], created_at: createdAt }]);

    const result = await saveTechnicalVisual(input, { requireRemote: true });

    expect(mockSupabaseGet).not.toHaveBeenCalled();
    expect(mockSupabasePatch).not.toHaveBeenCalled();
    expect(mockSupabasePost).toHaveBeenCalledTimes(1);
    const [path, rows, headers, identity] = mockSupabasePost.mock.calls[0];
    expect(path).toBe("/technical_visuals?on_conflict=id");
    expect(headers).toEqual({ Prefer: "resolution=merge-duplicates,return=representation" });
    expect(rows[0]).not.toHaveProperty("created_at");
    expect(rows[0]).toMatchObject({ id: "tv_autosave", organization_id: "org_1", class_id: "class_1" });
    expect(identity).toEqual({ userId: "user_1", generation: 0 });
    expect(result?.createdAt).toBe(createdAt);
    expect(result?.payload.timeline.steps).toHaveLength(input.payload.timeline.steps.length);
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
  });

  it("does not acknowledge an empty remote autosave response", async () => {
    await expect(saveTechnicalVisual({
      id: "tv_autosave", organizationId: "org_1", classId: "class_1", sourceKind: "free",
      title: "Jogada", payload: buildRotation5x1Preset(),
    }, { requireRemote: true })).rejects.toThrow("confirmar o salvamento");
    expect(mockSupabasePost).toHaveBeenCalledTimes(1);
    expect(mockSupabaseGet).not.toHaveBeenCalled();
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
  });

  it.each(["id", "organization_id", "class_id"] as const)("rejects a remote confirmation for another %s", async field => {
    mockSupabasePost.mockImplementationOnce(async (_path, rows) => [{
      ...rows[0], created_at: "2026-06-03T10:00:00.000Z", [field]: "another_scope",
    }]);
    await expect(saveTechnicalVisual({
      id: "tv_autosave", organizationId: "org_1", classId: "class_1", sourceKind: "free",
      title: "Jogada", payload: buildRotation5x1Preset(),
    }, { requireRemote: true })).rejects.toThrow("confirmar o salvamento");
    expect(mockSupabasePost).toHaveBeenCalledTimes(1);
    expect(mockSupabaseGet).not.toHaveBeenCalled();
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
  });

  it("keeps the manual local fallback available when no session is present", async () => {
    mockUserId = "";
    const input = { classId: "class_1", organizationId: "org_1", sourceKind: "free" as const, title: "Jogada", payload: buildRotation5x1Preset() };
    expect((await saveTechnicalVisual(input))?.id).toMatch(/^local_/);
    mockAsyncStorageSetItem.mockClear();
    await expect(saveTechnicalVisual(input, { requireRemote: true })).rejects.toThrow("Entre novamente");
    expect(mockSupabasePost).not.toHaveBeenCalled();
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
  });

  it("requires an organization for remote autosave", async () => {
    mockActiveOrganization.mockResolvedValueOnce(null);
    await expect(saveTechnicalVisual({
      classId: "class_1", sourceKind: "free", title: "Jogada", payload: buildRotation5x1Preset(),
    }, { requireRemote: true })).rejects.toThrow("Selecione uma organização");
    expect(mockSupabasePost).not.toHaveBeenCalled();
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
  });

  it("does not continue with POST or local fallback after the account changes during GET", async () => {
    mockIsAuthError.mockReturnValue(true);
    mockSupabaseGet.mockImplementationOnce(async () => {
      mockUserId = "user_2"; mockIdentityGeneration += 1;
      throw new Error("Session changed during GET");
    });
    await expect(saveTechnicalVisual({
      id: "tv_existing", organizationId: "org_1", classId: "class_1", sourceKind: "free",
      title: "Jogada", payload: buildRotation5x1Preset(),
    })).rejects.toThrow("A sessão mudou");
    expect(mockSupabasePost).not.toHaveBeenCalled();
    expect(mockSupabasePatch).not.toHaveBeenCalled();
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
  });

  it("does not continue a compound save after a workspace generation changes", async () => {
    mockSupabaseGet.mockImplementationOnce(async () => { mockCacheGeneration += 1; return []; });
    await expect(saveTechnicalVisual({
      id: "tv_existing", organizationId: "org_1", classId: "class_1", sourceKind: "free",
      title: "Jogada", payload: buildRotation5x1Preset(),
    })).rejects.toThrow("A sessão mudou");
    expect(mockSupabasePost).not.toHaveBeenCalled();
    expect(mockSupabasePatch).not.toHaveBeenCalled();
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
  });

  it("does not acknowledge a remote autosave after the workspace generation changes", async () => {
    mockSupabasePost.mockImplementationOnce(async (_path, rows) => {
      mockCacheGeneration += 1;
      return [{ ...rows[0], created_at: "2026-06-03T10:00:00.000Z" }];
    });
    await expect(saveTechnicalVisual({
      id: "tv_autosave", organizationId: "org_1", classId: "class_1", sourceKind: "free",
      title: "Jogada", payload: buildRotation5x1Preset(),
    }, { requireRemote: true })).rejects.toThrow("A sessão mudou");
    expect(mockSupabasePost.mock.calls[0][3]).toEqual({ userId: "user_1", generation: 0 });
    expect(mockSupabaseGet).not.toHaveBeenCalled();
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
  });

  it("does not acknowledge or cache a submitted save after the account changes", async () => {
    mockSupabasePost.mockImplementationOnce(async () => { mockUserId = "user_2"; mockIdentityGeneration += 1; return []; });
    await expect(saveTechnicalVisual({
      organizationId: "org_1", classId: "class_1", sourceKind: "free",
      title: "Jogada", payload: buildRotation5x1Preset(),
    })).rejects.toThrow("A sessão mudou");
    expect(mockSupabasePost.mock.calls[0][3]).toEqual({ userId: "user_1", generation: 0 });
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
  });

  it("does not write the fallback cache after the account changes during its read", async () => {
    mockIsNetworkError.mockReturnValue(true);
    mockSupabasePost.mockRejectedValueOnce(new Error("Network unavailable"));
    mockAsyncStorageGetItem.mockImplementationOnce(async () => { mockUserId = "user_2"; mockIdentityGeneration += 1; return null; });
    await expect(saveTechnicalVisual({
      organizationId: "org_1", classId: "class_1", sourceKind: "free",
      title: "Jogada", payload: buildRotation5x1Preset(),
    })).rejects.toThrow("A sessão mudou");
    expect(mockAsyncStorageSetItem).not.toHaveBeenCalled();
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
      "5x1 - Recepção",
      "5x1 base - equipe sacando",
      "Defesa base — 6 fundo",
      "Grade didática",
    ]);
    expect(mockSupabasePost).toHaveBeenCalledTimes(4);
  });
});
