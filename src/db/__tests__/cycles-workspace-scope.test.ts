const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockRunAsync = jest.fn();

jest.mock("../sqlite", () => ({
  db: {
    getAllAsync: (...args: unknown[]) => mockGetAllAsync(...args),
    getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
    runAsync: (...args: unknown[]) => mockRunAsync(...args),
  },
}));

import {
  ensureActiveCycleForYear,
  getActivePlanningCycle,
  getPlanningCycles,
  upsertPlanningCycle,
} from "../cycles";

describe("planning cycles workspace scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllAsync.mockResolvedValue([]);
    mockGetFirstAsync.mockResolvedValue(null);
    mockRunAsync.mockResolvedValue(undefined);
  });

  test("scopes cycle reads by organization and class", async () => {
    await getPlanningCycles("class_1", "org_1");
    await getActivePlanningCycle("class_1", "org_1");

    expect(mockGetAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("organizationId = ?"),
      ["class_1", "org_1"]
    );
    expect(mockGetFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("organizationId = ?"),
      ["class_1", "org_1"]
    );
  });

  test("persists the active workspace in a newly created cycle", async () => {
    const cycle = await ensureActiveCycleForYear(
      "class_1",
      "org_1",
      2026,
      "2026-02-01"
    );

    expect(cycle.organizationId).toBe("org_1");
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("organizationId"),
      expect.arrayContaining(["org_1", "class_1", 2026])
    );
  });

  test("persists the versioned periodization policy with the cycle", async () => {
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

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("periodizationPolicyJson"),
      expect.arrayContaining([expect.stringContaining('"loadModel":"blocos"'), 4]),
    );
  });
});
