import {
  adminListOrgAccessRequests,
  adminReviewOrgAccessRequest,
} from "../organization-access-requests";
import { supabaseRestPost } from "../rest";

jest.mock("../rest", () => ({
  supabaseRestPost: jest.fn(),
}));

const mockSupabaseRestPost = supabaseRestPost as jest.MockedFunction<
  typeof supabaseRestPost
>;

describe("organization access requests api", () => {
  beforeEach(() => {
    mockSupabaseRestPost.mockReset();
  });

  it("maps the canonical pending queue", async () => {
    mockSupabaseRestPost.mockResolvedValueOnce([
      {
        id: "request-1",
        organization_id: "org-1",
        requester_user_id: "user-1",
        requester_email: "maria@example.com",
        requester_name: "Maria Silva",
        status: "pending",
        requested_at: "2026-08-12T12:00:00.000Z",
        reviewed_at: null,
        reviewed_by: null,
        review_role_level: null,
      },
    ]);

    await expect(adminListOrgAccessRequests("org-1")).resolves.toEqual([
      expect.objectContaining({
        id: "request-1",
        organizationId: "org-1",
        requesterName: "Maria Silva",
        status: "pending",
      }),
    ]);
    expect(mockSupabaseRestPost).toHaveBeenCalledWith(
      "/rpc/admin_list_org_access_requests",
      { p_org_id: "org-1" },
      "return=representation"
    );
  });

  it("reviews access through one idempotent RPC", async () => {
    mockSupabaseRestPost.mockResolvedValueOnce([
      {
        request_id: "request-1",
        status: "approved",
        changed: true,
        member_user_id: "user-1",
        role_level: 10,
        reviewed_at: "2026-08-12T12:10:00.000Z",
      },
    ]);

    await expect(
      adminReviewOrgAccessRequest({
        requestId: "request-1",
        decision: "approved",
        roleLevel: 10,
        idempotencyKey: "review-key",
      })
    ).resolves.toEqual({
      requestId: "request-1",
      status: "approved",
      changed: true,
      memberUserId: "user-1",
      roleLevel: 10,
      reviewedAt: "2026-08-12T12:10:00.000Z",
    });
    expect(mockSupabaseRestPost).toHaveBeenCalledWith(
      "/rpc/admin_review_org_access_request",
      {
        p_request_id: "request-1",
        p_decision: "approved",
        p_role_level: 10,
        p_idempotency_key: "review-key",
      },
      "return=representation"
    );
  });
});
