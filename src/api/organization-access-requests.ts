import { supabaseRestPost } from "./rest";

export type OrganizationAccessRequest = {
  id: string;
  organizationId: string;
  requesterUserId: string;
  requesterEmail: string;
  requesterName: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewRoleLevel: 5 | 10 | 50 | null;
};

type OrganizationAccessRequestRow = {
  id: string;
  organization_id: string;
  requester_user_id: string;
  requester_email: string;
  requester_name: string | null;
  status: OrganizationAccessRequest["status"];
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_role_level: 5 | 10 | 50 | null;
};

type ReviewReceiptRow = {
  request_id: string;
  status: "approved" | "rejected";
  changed: boolean;
  member_user_id: string;
  role_level: 5 | 10 | 50 | null;
  reviewed_at: string;
};

export type OrganizationAccessRequestReviewReceipt = {
  requestId: string;
  status: "approved" | "rejected";
  changed: boolean;
  memberUserId: string;
  roleLevel: 5 | 10 | 50 | null;
  reviewedAt: string;
};

const mapAccessRequest = (
  row: OrganizationAccessRequestRow
): OrganizationAccessRequest => ({
  id: row.id,
  organizationId: row.organization_id,
  requesterUserId: row.requester_user_id,
  requesterEmail: row.requester_email,
  requesterName: row.requester_name?.trim() || row.requester_email,
  status: row.status,
  requestedAt: row.requested_at,
  reviewedAt: row.reviewed_at,
  reviewedBy: row.reviewed_by,
  reviewRoleLevel: row.review_role_level,
});

export async function adminListOrgAccessRequests(
  organizationId: string
): Promise<OrganizationAccessRequest[]> {
  const rows = await supabaseRestPost<OrganizationAccessRequestRow[]>(
    "/rpc/admin_list_org_access_requests",
    { p_org_id: organizationId },
    "return=representation"
  );
  return (rows ?? []).map(mapAccessRequest);
}

export async function adminReviewOrgAccessRequest({
  requestId,
  decision,
  roleLevel,
  idempotencyKey,
}: {
  requestId: string;
  decision: "approved" | "rejected";
  roleLevel: 5 | 10 | 50;
  idempotencyKey: string;
}): Promise<OrganizationAccessRequestReviewReceipt> {
  const rows = await supabaseRestPost<ReviewReceiptRow[]>(
    "/rpc/admin_review_org_access_request",
    {
      p_request_id: requestId,
      p_decision: decision,
      p_role_level: roleLevel,
      p_idempotency_key: idempotencyKey,
    },
    "return=representation"
  );
  const receipt = rows?.[0];
  if (!receipt) {
    throw new Error("O servidor não confirmou a revisão de acesso.");
  }
  return {
    requestId: receipt.request_id,
    status: receipt.status,
    changed: Boolean(receipt.changed),
    memberUserId: receipt.member_user_id,
    roleLevel: receipt.role_level,
    reviewedAt: receipt.reviewed_at,
  };
}
