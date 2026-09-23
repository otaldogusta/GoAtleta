import {
  applyClassStaffAssignmentsWithHistory,
  isClassStaffHistoryUnavailable,
  listClassStaffTimeline,
  registerClassStaffReturn,
  scheduleClassStaffSubstitution,
} from "../class-staff-history";

const mockRestGet = jest.fn();
const mockRestPost = jest.fn();

jest.mock("../rest", () => ({
  supabaseRestGet: (...args: unknown[]) => mockRestGet(...args),
  supabaseRestPost: (...args: unknown[]) => mockRestPost(...args),
}));
jest.mock("../../core/client-id", () => ({ createClientId: () => "idem-1" }));

describe("class staff history api", () => {
  beforeEach(() => jest.clearAllMocks());

  test("applies assignments with optimistic version and placeholder identity", async () => {
    mockRestPost.mockResolvedValue({ class_id: "class-1", version: 4, applied_at: "2026-09-21T10:00:00Z" });
    await expect(applyClassStaffAssignmentsWithHistory({
      organizationId: "org-1", classId: "class-1", expectedVersion: 3,
      assignments: [{ userId: "draft-1", isPlaceholder: true, displayName: "André", staffRole: "head" }],
    })).resolves.toEqual({ classId: "class-1", version: 4, appliedAt: "2026-09-21T10:00:00Z" });
    expect(mockRestPost).toHaveBeenCalledWith("/rpc/admin_apply_class_staff_assignments_v2", expect.objectContaining({
      p_expected_version: 3,
      p_idempotency_key: "idem-1",
      p_assignments: [{ user_id: null, staff_profile_id: null, display_name: "André", staff_role: "head" }],
    }), "return=representation");
  });

  test("retries a transient failure with the same idempotency key", async () => {
    mockRestPost
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ class_id: "class-1", version: 2, applied_at: "2026-09-21T10:00:00Z" });

    await expect(applyClassStaffAssignmentsWithHistory({
      organizationId: "org-1",
      classId: "class-1",
      expectedVersion: 1,
      assignments: [{ userId: "andre", staffRole: "head" }],
    })).resolves.toMatchObject({ classId: "class-1", version: 2 });

    expect(mockRestPost).toHaveBeenCalledTimes(2);
    expect(mockRestPost.mock.calls[0]?.[1]).toMatchObject({ p_idempotency_key: "idem-1" });
    expect(mockRestPost.mock.calls[1]?.[1]).toMatchObject({ p_idempotency_key: "idem-1" });
  });

  test("recognizes every missing history dependency used by class duplication", () => {
    expect(isClassStaffHistoryUnavailable(new Error("PGRST205 class_staff_versions"))).toBe(true);
    expect(isClassStaffHistoryUnavailable(new Error("PGRST202 admin_apply_class_staff_assignments_v2"))).toBe(true);
    expect(isClassStaffHistoryUnavailable(new Error("permission denied"))).toBe(false);
  });

  test("maps the three timeline collections", async () => {
    mockRestGet
      .mockResolvedValueOnce([{ id: "t1", organization_id: "o", class_id: "c", user_id: "u", staff_profile_id: null, display_name_snapshot: "André", staff_role: "head", status: "active", starts_on: "2026-09-01", ends_on: null, date_precision: "exact", reason: null, notes: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const result = await listClassStaffTimeline("o", "c");
    expect(result.tenures[0]).toMatchObject({ id: "t1", displayName: "André", staffRole: "head" });
  });

  test("sends scheduled substitutions and explicit returns through RPCs", async () => {
    mockRestPost.mockResolvedValueOnce("sub-1").mockResolvedValueOnce(null);
    await scheduleClassStaffSubstitution({ organizationId: "o", classId: "c", absentTenureId: "t", replacementUserId: "u2", startsOn: "2026-09-21", endsOn: "2026-09-30", reason: "Férias" });
    await registerClassStaffReturn({ organizationId: "o", substitutionId: "sub-1", returnedOn: "2026-09-28" });
    expect(mockRestPost).toHaveBeenNthCalledWith(1, "/rpc/admin_schedule_class_substitution", expect.objectContaining({ p_absent_tenure_id: "t", p_replacement_user_id: "u2" }), "return=representation");
    expect(mockRestPost).toHaveBeenNthCalledWith(2, "/rpc/admin_register_class_staff_return", expect.objectContaining({ p_substitution_id: "sub-1", p_returned_on: "2026-09-28" }), "return=minimal");
  });
});
