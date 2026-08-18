import type { ClassPlan } from "../../core/models";
import { saveClassPlans, updateClassPlan } from "../periodization";
import { supabasePatch, supabasePost } from "../client";

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

const plan: ClassPlan = {
  id: "plan-1",
  classId: "class-1",
  cycleId: "cycle-1",
  startDate: "2027-01-04",
  weekNumber: 1,
  phase: "Adaptação",
  theme: "Continuidade",
  technicalFocus: "Toque",
  physicalFocus: "Coordenação",
  constraints: "",
  mvFormat: "4x2",
  warmupProfile: "progressivo",
  jumpTarget: "baixo",
  rpeTarget: "PSE 3-4",
  source: "AUTO",
  createdAt: "2027-01-01T00:00:00.000Z",
  updatedAt: "2027-01-01T00:00:00.000Z",
};

describe("class plan write compatibility fallback", () => {
  beforeEach(() => {
    jest.mocked(supabasePost).mockReset();
    jest.mocked(supabasePatch).mockReset();
  });

  it("preserves cycle_id when retrying without optional snapshot columns", async () => {
    jest.mocked(supabasePost)
      .mockRejectedValueOnce(
        new Error(
          'PGRST204: Could not find the "blueprint_id" column of "class_plans" in the schema cache',
        ),
      )
      .mockResolvedValueOnce(undefined);

    await saveClassPlans([plan], { organizationId: "org-1" });

    const retryPayload = jest.mocked(supabasePost).mock.calls[1]?.[1] as Record<
      string,
      unknown
    >[];
    expect(retryPayload[0]).toMatchObject({
      id: "plan-1",
      cycle_id: "cycle-1",
      organization_id: "org-1",
    });
    expect(retryPayload[0]).not.toHaveProperty("blueprint_id");
  });

  it("does not reinterpret a cycle constraint violation as a missing column", async () => {
    const constraintError = new Error(
      '23502: null value in column "cycle_id" of relation "class_plans" violates not-null constraint',
    );
    jest.mocked(supabasePost).mockRejectedValueOnce(constraintError);

    await expect(
      saveClassPlans([plan], { organizationId: "org-1" }),
    ).rejects.toBe(constraintError);
    expect(supabasePost).toHaveBeenCalledTimes(1);
  });

  it("preserves cycle_id when updating a plan on the compatibility path", async () => {
    jest.mocked(supabasePatch)
      .mockRejectedValueOnce(
        new Error(
          'PGRST204: Could not find the "sync_status" column of "class_plans" in the schema cache',
        ),
      )
      .mockResolvedValueOnce(undefined);

    await updateClassPlan(plan, { organizationId: "org-1" });

    const retryPayload = jest.mocked(supabasePatch).mock.calls[1]?.[1] as Record<
      string,
      unknown
    >;
    expect(retryPayload).toMatchObject({
      cycle_id: "cycle-1",
      organization_id: "org-1",
    });
    expect(retryPayload).not.toHaveProperty("sync_status");
  });
});
