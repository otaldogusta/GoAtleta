import {
  forceRefreshAccessToken,
  getValidAccessToken,
} from "../auth/session";
import { parseInviteApiResponse } from "./invite-errors";
import { supabaseRestPost } from "./rest";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type StudentRelationshipKind =
  | "athlete"
  | "guardian"
  | "payer"
  | "viewer";

export type StudentRelationshipPermissions = {
  canViewProfile: boolean;
  canViewSchedule: boolean;
  canViewAttendance: boolean;
  canViewProgress: boolean;
  canViewHealth: boolean;
  canSignConsents: boolean;
  canViewFinancial: boolean;
  canPay: boolean;
};

export type CreateStudentRelationshipInviteInput = {
  organizationId: string;
  studentId: string;
  invitedEmail: string;
  relationshipKind: StudentRelationshipKind;
  relationshipLabel?: string;
  invitedVia?: "email" | "whatsapp" | "link";
  permissions?: Partial<StudentRelationshipPermissions>;
};

export type CreateStudentRelationshipInviteResult = {
  inviteId: string;
  expiresAt: string;
  token: string;
  inviteUrl: string;
};

export type StudentRelationshipInvitePreview = {
  inviteId: string;
  organization: { id: string; name: string };
  student: { id: string; name: string };
  relationship: {
    kind: StudentRelationshipKind;
    label: string | null;
  };
  expiresAt: string;
  permissions: StudentRelationshipPermissions;
};

export type StudentRelationshipClaimReceipt = {
  status: "claimed" | "already_claimed";
  relationshipId: string;
  organizationId: string;
  studentId: string;
  relationshipKind: StudentRelationshipKind;
};

export type StudentRelationshipInviteStatus =
  | "pending"
  | "claimed"
  | "revoked"
  | "expired";

export type StudentRelationshipInvite = {
  id: string;
  invitedEmail: string;
  invitedVia: "email" | "whatsapp" | "link";
  relationshipKind: StudentRelationshipKind;
  relationshipLabel: string | null;
  status: StudentRelationshipInviteStatus;
  expiresAt: string;
  createdAt: string;
  createdBy: string | null;
  usedAt: string | null;
  claimedBy: string | null;
  revokedAt: string | null;
};

export type StudentRelationship = StudentRelationshipPermissions & {
  id: string;
  userId: string | null;
  contactEmail: string | null;
  kind: StudentRelationshipKind;
  label: string | null;
  status: "active" | "revoked";
  claimedAt: string;
  revokedAt: string | null;
};

export type RevokeStudentRelationshipInput = {
  organizationId: string;
  studentId: string;
  relationshipId: string;
  reason: string;
  clearLegacyLoginEmail?: boolean;
};

export type RevokeStudentRelationshipInviteInput = {
  organizationId: string;
  studentId: string;
  inviteId: string;
  reason: string;
};

type StudentRelationshipRow = {
  relationship_id?: unknown;
  user_id?: unknown;
  contact_email?: unknown;
  relationship_kind?: unknown;
  relationship_label?: unknown;
  status?: unknown;
  can_view_profile?: unknown;
  can_view_schedule?: unknown;
  can_view_attendance?: unknown;
  can_view_progress?: unknown;
  can_view_health?: unknown;
  can_sign_consents?: unknown;
  can_view_financial?: unknown;
  can_pay?: unknown;
  claimed_at?: unknown;
  revoked_at?: unknown;
};

type StudentRelationshipInviteRow = {
  invite_id?: unknown;
  invited_email?: unknown;
  invited_via?: unknown;
  relationship_kind?: unknown;
  relationship_label?: unknown;
  status?: unknown;
  expires_at?: unknown;
  created_at?: unknown;
  created_by?: unknown;
  used_at?: unknown;
  claimed_by?: unknown;
  revoked_at?: unknown;
};

const edgeBaseUrl = SUPABASE_URL.replace(/\/$/, "") + "/functions/v1";

const waitForAccessToken = async () => {
  let token = await getValidAccessToken();
  if (token) return token;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    token = await getValidAccessToken();
    if (token) return token;
  }
  return "";
};

const edgeRequest = async (
  functionName: string,
  body: Record<string, unknown>,
  authenticated: boolean,
) => {
  const execute = (accessToken?: string) =>
    fetch(`${edgeBaseUrl}/${functionName}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  if (!authenticated) return execute();
  const token = await waitForAccessToken();
  if (!token) throw new Error("Missing auth token");
  let response = await execute(token);
  if (response.status === 401) {
    const refreshed = await forceRefreshAccessToken();
    if (refreshed) response = await execute(refreshed);
  }
  return response;
};

const requiredString = (value: unknown, field: string) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
};

const asBoolean = (value: unknown) => value === true;
const optionalString = (value: unknown) =>
  String(value ?? "").trim() || null;

export const mapStudentRelationship = (
  row: StudentRelationshipRow,
): StudentRelationship => ({
  id: requiredString(row.relationship_id, "relationship_id"),
  userId: optionalString(row.user_id),
  contactEmail: optionalString(row.contact_email),
  kind: requiredString(row.relationship_kind, "relationship_kind") as StudentRelationshipKind,
  label: optionalString(row.relationship_label),
  status: requiredString(row.status, "status") as StudentRelationship["status"],
  canViewProfile: asBoolean(row.can_view_profile),
  canViewSchedule: asBoolean(row.can_view_schedule),
  canViewAttendance: asBoolean(row.can_view_attendance),
  canViewProgress: asBoolean(row.can_view_progress),
  canViewHealth: asBoolean(row.can_view_health),
  canSignConsents: asBoolean(row.can_sign_consents),
  canViewFinancial: asBoolean(row.can_view_financial),
  canPay: asBoolean(row.can_pay),
  claimedAt: requiredString(row.claimed_at, "claimed_at"),
  revokedAt: optionalString(row.revoked_at),
});

export const mapStudentRelationshipInvite = (
  row: StudentRelationshipInviteRow,
): StudentRelationshipInvite => ({
  id: requiredString(row.invite_id, "invite_id"),
  invitedEmail: requiredString(row.invited_email, "invited_email"),
  invitedVia: requiredString(row.invited_via, "invited_via") as StudentRelationshipInvite["invitedVia"],
  relationshipKind: requiredString(
    row.relationship_kind,
    "relationship_kind",
  ) as StudentRelationshipKind,
  relationshipLabel: optionalString(row.relationship_label),
  status: requiredString(
    row.status,
    "status",
  ) as StudentRelationshipInviteStatus,
  expiresAt: requiredString(row.expires_at, "expires_at"),
  createdAt: requiredString(row.created_at, "created_at"),
  createdBy: optionalString(row.created_by),
  usedAt: optionalString(row.used_at),
  claimedBy: optionalString(row.claimed_by),
  revokedAt: optionalString(row.revoked_at),
});

export async function createStudentRelationshipInvite(
  input: CreateStudentRelationshipInviteInput,
) {
  const response = await edgeRequest(
    "create-student-relationship-invite",
    {
      organizationId: input.organizationId,
      studentId: input.studentId,
      invitedEmail: input.invitedEmail,
      relationshipKind: input.relationshipKind,
      relationshipLabel: input.relationshipLabel,
      invitedVia: input.invitedVia ?? "email",
      permissions: input.permissions ?? {},
    },
    true,
  );
  return parseInviteApiResponse<CreateStudentRelationshipInviteResult>(
    response,
    "Não foi possível criar o convite.",
  );
}

export async function validateStudentRelationshipInvite(token: string) {
  const response = await edgeRequest(
    "validate-student-relationship-invite",
    { token },
    false,
  );
  return parseInviteApiResponse<{
    status: "valid";
    preview: StudentRelationshipInvitePreview;
  }>(response, "Não foi possível verificar o convite.");
}

export async function claimStudentRelationshipInvite(token: string) {
  const response = await edgeRequest(
    "claim-student-relationship-invite",
    { token },
    true,
  );
  const result = await parseInviteApiResponse<{
    receipt: StudentRelationshipClaimReceipt;
  }>(response, "Não foi possível aceitar o convite.");
  return result.receipt;
}

export async function listStudentRelationships(
  organizationId: string,
  studentId: string,
) {
  const rows = await supabaseRestPost<StudentRelationshipRow[]>(
    "/rpc/list_student_relationships_v1",
    { p_org_id: organizationId, p_student_id: studentId },
  );
  return (rows ?? []).map(mapStudentRelationship);
}

export async function listStudentRelationshipInvites(
  organizationId: string,
  studentId: string,
) {
  const rows = await supabaseRestPost<StudentRelationshipInviteRow[]>(
    "/rpc/list_student_relationship_invites_v1",
    { p_org_id: organizationId, p_student_id: studentId },
  );
  return (rows ?? []).map(mapStudentRelationshipInvite);
}

export async function revokeStudentRelationshipInvite(
  input: RevokeStudentRelationshipInviteInput,
) {
  if (!input.organizationId.trim() || !input.studentId.trim()) {
    throw new Error("Organization and student are required");
  }
  if (!input.inviteId.trim() || !input.reason.trim()) {
    throw new Error("Invite and reason are required");
  }
  await supabaseRestPost<null>(
    "/rpc/revoke_student_relationship_invite_v1",
    {
      p_invite_id: input.inviteId,
      p_reason: input.reason.trim(),
    },
    "return=minimal",
  );
  return listStudentRelationshipInvites(input.organizationId, input.studentId);
}

export async function revokeStudentRelationship(
  input: RevokeStudentRelationshipInput,
) {
  if (!input.organizationId.trim() || !input.studentId.trim()) {
    throw new Error("Organization and student are required");
  }
  if (!input.relationshipId.trim() || !input.reason.trim()) {
    throw new Error("Relationship and reason are required");
  }
  await supabaseRestPost<null>(
    "/rpc/revoke_student_relationship_v1",
    {
      p_relationship_id: input.relationshipId,
      p_reason: input.reason.trim(),
      p_clear_legacy_login_email: input.clearLegacyLoginEmail ?? false,
    },
    "return=minimal",
  );
  return listStudentRelationships(input.organizationId, input.studentId);
}
