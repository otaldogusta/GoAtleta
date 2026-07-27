import { deleteClassPlansByClass } from "../periodization";
import { getActiveOrganizationId, supabaseDelete } from "../client";

jest.mock("../client", () => ({
  CACHE_KEYS: {},
  getActiveOrganizationId: jest.fn(),
  getScopedOrganizationId: jest.fn(),
  isMissingRelation: jest.fn(() => false),
  isNetworkError: jest.fn(() => false),
  readCache: jest.fn(),
  supabaseDelete: jest.fn(),
  supabaseGet: jest.fn(),
  supabasePatch: jest.fn(),
  supabasePost: jest.fn(),
  writeCache: jest.fn(),
}));

describe("deleteClassPlansByClass source filtering", () => {
  beforeEach(() => {
    jest.mocked(getActiveOrganizationId).mockResolvedValue("org-1");
    jest.mocked(supabaseDelete).mockReset();
    jest.mocked(supabaseDelete).mockResolvedValue(undefined);
  });

  it("deletes only automatic weeks when requested", async () => {
    await deleteClassPlansByClass("class-1", {
      cycleYear: 2026,
      source: "AUTO",
    });

    expect(supabaseDelete).toHaveBeenCalledWith(
      "/class_plans?classid=eq.class-1&startdate=gte.2026-01-01&startdate=lte.2026-12-31&source=eq.AUTO&organization_id=eq.org-1",
    );
  });

  it("keeps the legacy all-source behavior when source is omitted", async () => {
    await deleteClassPlansByClass("class-1", { cycleYear: 2026 });

    expect(supabaseDelete).toHaveBeenCalledWith(
      "/class_plans?classid=eq.class-1&startdate=gte.2026-01-01&startdate=lte.2026-12-31&organization_id=eq.org-1",
    );
  });
});
