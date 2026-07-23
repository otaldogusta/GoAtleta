import {
  ensureActiveCycleForYear,
  getActivePlanningCycle,
  getPlanningCycles,
} from "../cycles";

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
});
