const mockGetAllAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockSupabaseGet = jest.fn();
const mockSupabasePatch = jest.fn();
const mockSupabasePost = jest.fn();

jest.mock("../sqlite", () => ({
  db: {
    getAllAsync: (...args: unknown[]) => mockGetAllAsync(...args),
    runAsync: (...args: unknown[]) => mockRunAsync(...args),
  },
}));

jest.mock("../client", () => ({
  getScopedOrganizationId: async (candidate: string | null | undefined) =>
    candidate?.trim() || null,
  isMissingColumnInSchemaCache: (error: unknown, column: string) =>
    String(error).toLowerCase().includes(column.toLowerCase()),
  isMissingRelation: () => false,
  isNetworkError: () => false,
  supabaseGet: (...args: unknown[]) => mockSupabaseGet(...args),
  supabasePatch: (...args: unknown[]) => mockSupabasePatch(...args),
  supabasePost: (...args: unknown[]) => mockSupabasePost(...args),
}));

import {
  archivePlanningCycle,
  ensureActiveCycleForYear,
  getActivePlanningCycle,
  getOrCreateInitialActivePlanningCycle,
  getPlanningCycles,
  upsertPlanningCycle,
} from "../cycles";

const remoteCycle = {
  id: "cycle_1",
  organization_id: "org_1",
  classid: "class_1",
  year: 2026,
  title: "Ciclo 2026",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("planning cycles workspace scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllAsync.mockResolvedValue([]);
    mockRunAsync.mockResolvedValue(undefined);
    mockSupabaseGet.mockResolvedValue([]);
    mockSupabasePatch.mockResolvedValue([]);
    mockSupabasePost.mockResolvedValue([]);
  });

  test("scopes Supabase cycle reads by organization and class", async () => {
    mockSupabaseGet.mockResolvedValue([remoteCycle]);

    await getPlanningCycles("class_1", "org_1");
    await getActivePlanningCycle("class_1", "org_1");

    expect(mockSupabaseGet).toHaveBeenCalledTimes(2);
    expect(mockSupabaseGet).toHaveBeenCalledWith(
      expect.stringContaining("classid=eq.class_1"),
    );
    expect(mockSupabaseGet).toHaveBeenCalledWith(
      expect.stringContaining("organization_id=eq.org_1"),
    );
  });

  test("maps the canonical Supabase columns", async () => {
    mockSupabaseGet.mockResolvedValue([remoteCycle]);

    await expect(getActivePlanningCycle("class_1", "org_1")).resolves.toMatchObject({
      id: "cycle_1",
      organizationId: "org_1",
      classId: "class_1",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
    });
  });

  test("keeps local policy metadata until the additive columns are migrated", async () => {
    mockGetAllAsync.mockResolvedValueOnce([
      {
        id: "cycle_1",
        organizationId: "org_1",
        classId: "class_1",
        year: 2026,
        title: "Ciclo 2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "active",
        periodizationPolicyJson: '{"loadModel":"blocos"}',
        policyVersion: 4,
      },
    ]);
    mockSupabaseGet.mockResolvedValueOnce([remoteCycle]);

    await expect(getActivePlanningCycle("class_1", "org_1")).resolves.toMatchObject({
      periodizationPolicyJson: '{"loadModel":"blocos"}',
      policyVersion: 4,
    });
  });

  test("persists the versioned periodization policy remotely and locally", async () => {
    await upsertPlanningCycle({
      id: "cycle_1",
      organizationId: "org_1",
      classId: "class_1",
      year: 2026,
      title: "Ciclo 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      periodizationPolicyJson: JSON.stringify({
        schemaVersion: 1,
        loadModel: "blocos",
        recoveryWeeks: 5,
        intensityMin: 3,
        intensityMax: 8,
      }),
      policyVersion: 4,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
    });

    expect(mockSupabasePost).toHaveBeenCalledWith(
      "/planning_cycles",
      [
        expect.objectContaining({
          organization_id: "org_1",
          classid: "class_1",
          start_date: "2026-01-01",
          periodization_policy_json: expect.objectContaining({ loadModel: "blocos" }),
          policy_version: 4,
        }),
      ],
      { Prefer: "resolution=merge-duplicates" },
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("periodizationPolicyJson"),
      expect.arrayContaining([expect.stringContaining('"loadModel":"blocos"'), 4]),
    );
  });

  test("archives exactly the cycle in the requested workspace", async () => {
    mockSupabasePatch.mockResolvedValue([{ id: "cycle_1" }]);

    await archivePlanningCycle("cycle_1", "org_1");

    expect(mockSupabasePatch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/planning_cycles?id=eq.cycle_1&organization_id=eq.org_1&select=id",
      ),
      expect.objectContaining({ status: "archived" }),
      { Prefer: "return=representation" },
    );
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("organizationId = ?"),
      expect.arrayContaining(["cycle_1", "org_1"]),
    );
  });

  test("rejects a silent RLS or stale-cycle no-op", async () => {
    mockSupabasePatch.mockResolvedValue([]);

    await expect(archivePlanningCycle("cycle_1", "org_1")).rejects.toThrow(
      "não foi encontrado neste workspace",
    );
    expect(mockRunAsync).not.toHaveBeenCalled();
  });

  test("does not reopen a cycle archived in the same year", async () => {
    mockSupabaseGet.mockResolvedValueOnce([
      { ...remoteCycle, status: "archived" },
    ]);

    const result = await getOrCreateInitialActivePlanningCycle(
      "class_1",
      "org_1",
      2026,
      "2026-02-01",
    );

    expect(result.activeCycle).toBeNull();
    expect(mockSupabasePost).not.toHaveBeenCalled();
  });

  test("requires another year before explicitly creating a cycle after archive", async () => {
    mockSupabaseGet.mockResolvedValueOnce([
      { ...remoteCycle, status: "archived" },
    ]);

    await expect(
      ensureActiveCycleForYear("class_1", "org_1", 2026, "2026-02-01"),
    ).rejects.toThrow("Escolha uma data de início em outro ano");
    expect(mockSupabasePost).not.toHaveBeenCalled();
  });

  test("creates the initial active cycle when none was persisted", async () => {
    mockSupabaseGet.mockResolvedValue([]);

    const result = await getOrCreateInitialActivePlanningCycle(
      "class_1",
      "org_1",
      2026,
      "2026-02-01",
    );

    expect(result.activeCycle).toMatchObject({
      classId: "class_1",
      organizationId: "org_1",
      year: 2026,
      status: "active",
    });
    expect(mockSupabasePatch).toHaveBeenCalledWith(
      expect.stringContaining("organization_id=eq.org_1"),
      expect.objectContaining({ status: "archived" }),
    );
    expect(mockSupabasePost).toHaveBeenCalled();
  });

  test("normalizes the active cycle window through the remote upsert", async () => {
    mockSupabaseGet.mockResolvedValueOnce([
      { ...remoteCycle, title: "2026", start_date: "2026-01-01" },
    ]);

    const cycle = await ensureActiveCycleForYear(
      "class_1",
      "org_1",
      2026,
      "2026-02-01",
    );

    expect(cycle.organizationId).toBe("org_1");
    expect(mockSupabasePost).toHaveBeenCalledWith(
      "/planning_cycles",
      [expect.objectContaining({ organization_id: "org_1", classid: "class_1" })],
      { Prefer: "resolution=merge-duplicates" },
    );
  });
});
