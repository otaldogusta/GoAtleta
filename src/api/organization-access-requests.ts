import { supabaseRestPost } from "./rest";

export type AccessRequestOrganization = { id: string; name: string };
export type AccessProduct = "goatleta" | "goatleta_pro";
export type AccessPaymentStatus = "not_started" | "pending" | "paid" | "overdue";

export type OrganizationAccessRequest = {
  requestKind?: "staff" | "athlete" | "guardian";
  requestedStudentName?: string | null;
  requestedRelationshipLabel?: string | null;
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
  organizationName?: string;
  requestedProduct: AccessProduct;
  paymentStatus: AccessPaymentStatus;
};

type OrganizationAccessRequestRow = {
  request_kind?: "staff" | "athlete" | "guardian";
  requested_student_name?: string | null;
  requested_relationship_label?: string | null;
  id: string;
  organization_id: string;
  requester_user_id?: string;
  requester_email?: string;
  requester_name: string | null;
  status: OrganizationAccessRequest["status"];
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_role_level: 5 | 10 | 50 | null;
  organization_name?: string;
  requested_product?: AccessProduct;
  payment_status?: AccessPaymentStatus;
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
  requestKind: row.request_kind ?? "staff",
  requestedStudentName: row.requested_student_name,
  requestedRelationshipLabel: row.requested_relationship_label,
  id: row.id,
  organizationId: row.organization_id,
  requesterUserId: row.requester_user_id ?? "",
  requesterEmail: row.requester_email ?? "",
  requesterName: row.requester_name?.trim() || row.requester_email || "Minha solicitação",
  status: row.status,
  requestedAt: row.requested_at,
  reviewedAt: row.reviewed_at,
  reviewedBy: row.reviewed_by,
  reviewRoleLevel: row.review_role_level,
  organizationName: row.organization_name,
  requestedProduct: row.requested_product ?? "goatleta",
  paymentStatus: row.payment_status ?? "not_started",
});

export async function searchAccessRequestOrganizations(
  query: string
): Promise<AccessRequestOrganization[]> {
  return await supabaseRestPost<AccessRequestOrganization[]>(
    "/rpc/search_access_request_organizations",
    { p_query: query.trim() },
    "return=representation"
  );
}

export async function listMyOrganizationAccessRequests(): Promise<OrganizationAccessRequest[]> {
  const rows = await listRequests("self");
  return (rows ?? []).map(mapAccessRequest);
}

export async function platformListAccessRequests(): Promise<OrganizationAccessRequest[]> {
  const rows = await listRequests("platform");
  return (rows ?? []).map(mapAccessRequest);
}

export async function isPlatformAdmin(): Promise<boolean> {
  return Boolean(await supabaseRestPost<boolean>("/rpc/is_platform_admin", {}));
}

export async function platformReviewAccessRequest({
  requestId,
  decision,
  roleLevel = 10,
  idempotencyKey,
}: {
  requestId: string;
  decision: "approved" | "rejected";
  roleLevel?: 5 | 10 | 50;
  idempotencyKey: string;
}): Promise<OrganizationAccessRequestReviewReceipt> {
  const rows = await supabaseRestPost<ReviewReceiptRow[]>(
    "/rpc/platform_review_access_request",
    {
      p_request_id: requestId,
      p_decision: decision,
      p_role_level: roleLevel,
      p_idempotency_key: idempotencyKey,
    },
    "return=representation"
  );
  const receipt = rows?.[0];
  if (!receipt) throw new Error("O servidor não confirmou a revisão de acesso.");
  return {
    requestId: receipt.request_id,
    status: receipt.status,
    changed: Boolean(receipt.changed),
    memberUserId: receipt.member_user_id,
    roleLevel: receipt.role_level,
    reviewedAt: receipt.reviewed_at,
  };
}

export async function adminListOrgAccessRequests(
  organizationId: string
): Promise<OrganizationAccessRequest[]> {
  const rows = await listRequests("coord", organizationId);
  return (rows ?? []).map(mapAccessRequest);
}

async function listRequests(scope: "self" | "coord" | "platform", organizationId?: string) {
  try {
    return await supabaseRestPost<OrganizationAccessRequestRow[]>("/rpc/list_access_requests_v2",
      { p_scope: scope, ...(organizationId ? { p_org_id: organizationId } : {}) }, "return=representation");
  } catch (error) {
    // Staged local rollout only: never hide authorization or network failures.
    let code: unknown;
    try { code = JSON.parse(error instanceof Error ? error.message : "").code; } catch { /* not a PostgREST error */ }
    if (code !== "PGRST202") throw error;
    const legacy = { self: "list_my_organization_access_requests", coord: "admin_list_org_access_requests", platform: "platform_list_access_requests" };
    return supabaseRestPost<OrganizationAccessRequestRow[]>(`/rpc/${legacy[scope]}`,
      scope === "coord" ? { p_org_id: organizationId } : {}, "return=representation");
  }
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
