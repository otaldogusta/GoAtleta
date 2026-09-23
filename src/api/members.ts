import { supabaseRestGet, supabaseRestPost } from "./rest";
import type { ClassStaffAssignment } from "./class-responsibles";
import {
  PROFILE_NAME_FALLBACK,
  normalizeProfileName,
  resolveProfileDisplayName,
} from "../core/profile-name";

export type OrgMember = {
  staffProfileId?: string | null;
  isPlaceholder?: boolean;
  organizationId: string;
  userId: string;
  roleLevel: number;
  createdAt: string;
  displayName: string;
  email: string | null;
  lastAccessAt: string | null;
};

export const listOrgStaffContactEmails = async (orgId: string): Promise<Map<string, string>> => {
  if (!orgId.trim()) return new Map();
  try {
    const rows = await supabaseRestPost<{ user_id: string; email: string | null }[]>(
      "/rpc/admin_list_org_staff_contacts", { p_org_id: orgId }, "return=representation"
    );
    return new Map((rows ?? []).filter((row) => row.email).map((row) => [row.user_id, row.email!]));
  } catch (error) {
    // Old databases and non-admin callers retain names without disclosing contacts.
    const message = error instanceof Error ? error.message : String(error);
    if (/PGRST202|42501|Not authorized/.test(message)) return new Map();
    throw error;
  }
};

export type OrgClass = {
  id: string;
  name: string;
  unit: string;
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
};

export type MemberClassHead = {
  userId: string;
  classId: string;
  className: string;
  unit: string;
};

export type MemberClassAssignment = MemberClassHead & {
  staffRole: "head" | "assistant" | "intern";
};

type OrgMemberRow = {
  organization_id: string;
  user_id: string;
  role_level: number;
  created_at: string;
  display_name?: string | null;
  email?: string | null;
  last_access_at?: string | null;
};

type OrgClassRow = {
  id: string;
  name: string;
  unit?: string | null;
};

type MemberClassHeadRow = {
  user_id: string;
  class_id: string;
  class_name: string;
  unit?: string | null;
};

type MemberClassAssignmentRow = MemberClassHeadRow & {
  staff_role: MemberClassAssignment["staffRole"];
};

const getMemberEmailFallback = (email: unknown) => {
  const localPart = normalizeProfileName(email).split("@")[0]?.trim();
  return localPart || PROFILE_NAME_FALLBACK;
};

const mapMember = (row: OrgMemberRow): OrgMember => ({
  organizationId: row.organization_id,
  userId: row.user_id,
  roleLevel: row.role_level,
  createdAt: row.created_at,
  displayName: resolveProfileDisplayName({
    displayName: row.display_name,
    email: row.email,
    fallback: getMemberEmailFallback(row.email),
  }),
  email: row.email ?? null,
  lastAccessAt: row.last_access_at ?? null,
});

const mapOrgClass = (row: OrgClassRow): OrgClass => ({
  id: row.id,
  name: row.name,
  unit: row.unit ?? "Sem unidade",
});

const mapMemberClassHead = (row: MemberClassHeadRow): MemberClassHead => ({
  userId: row.user_id,
  classId: row.class_id,
  className: row.class_name,
  unit: row.unit ?? "Sem unidade",
});

const mapMemberClassAssignment = (
  row: MemberClassAssignmentRow
): MemberClassAssignment => ({
  ...mapMemberClassHead(row),
  staffRole: row.staff_role,
});

export type MemberPermissionKey =
  | "reports"
  | "events"
  | "students"
  | "classes"
  | "training"
  | "periodization"
  | "calendar"
  | "absence_notices"
  | "whatsapp_settings"
  | "assistant"
  | "org_members"
  | "financial";

export type MemberPermission = {
  permissionKey: MemberPermissionKey;
  isAllowed: boolean;
};

export type MemberAccessChangeReceipt = {
  receiptId: string;
  changed: boolean;
  roleLevel: 5 | 10 | 50;
  classCount: number;
  permissionCount: number;
  notificationId: string | null;
  appliedAt: string;
};

type MemberPermissionRow = {
  permission_key: MemberPermissionKey;
  is_allowed: boolean;
};

type MemberAccessChangeReceiptRow = {
  receipt_id: string;
  changed: boolean;
  role_level: 5 | 10 | 50;
  class_count: number;
  permission_count: number;
  notification_id: string | null;
  applied_at: string;
};

export const MEMBER_PERMISSION_OPTIONS: {
  key: MemberPermissionKey;
  label: string;
  description: string;
}[] = [
  {
    key: "reports",
    label: "Relat\u00f3rios",
    description: "Acessar a \u00e1rea de relat\u00f3rios.",
  },
  {
    key: "events",
    label: "Eventos",
    description: "Acessar calend\u00e1rio e lista de eventos.",
  },
  {
    key: "students",
    label: "Alunos",
    description: "Acessar cadastro e listagem de alunos.",
  },
  {
    key: "financial",
    label: "Financeiro",
    description: "Consultar e atualizar a situação financeira dos alunos.",
  },
  {
    key: "classes",
    label: "Turmas",
    description: "Acessar turmas, chamada e sess\u00e3o.",
  },
  {
    key: "training",
    label: "Planejamento",
    description: "Acessar planejamentos e modelos.",
  },
  {
    key: "periodization",
    label: "Periodiza\u00e7\u00e3o",
    description: "Acessar periodiza\u00e7\u00e3o semanal.",
  },
  {
    key: "calendar",
    label: "Calend\u00e1rio",
    description: "Acessar calend\u00e1rio mensal.",
  },
  {
    key: "absence_notices",
    label: "Avisos de aus\u00eancia",
    description: "Acessar avisos e aus\u00eancias.",
  },
  {
    key: "whatsapp_settings",
    label: "Configura\u00e7\u00e3o WhatsApp",
    description: "Acessar configura\u00e7\u00e3o de WhatsApp.",
  },
  {
    key: "assistant",
    label: "Assistente AI",
    description: "Acessar assistente AI.",
  },
  {
    key: "org_members",
    label: "Gest\u00e3o de membros",
    description: "Acessar gest\u00e3o de membros da organiza\u00e7\u00e3o.",
  },
];

const mapPermission = (row: MemberPermissionRow): MemberPermission => ({
  permissionKey: row.permission_key,
  isAllowed: Boolean(row.is_allowed),
});

export const adminListOrgMembers = async (orgId: string): Promise<OrgMember[]> => {
  const rows = await supabaseRestPost<OrgMemberRow[]>(
    "/rpc/admin_list_org_members",
    { p_org_id: orgId },
    "return=representation"
  );
  return (rows ?? []).map(mapMember);
};

/** Staff picker identities, including internal profiles that have no app account. */
export const listOrgStaffCandidates = async (orgId: string): Promise<OrgMember[]> => {
  if (!orgId.trim()) return [];
  const [members, profiles, contacts] = await Promise.all([
    adminListOrgMembers(orgId),
    supabaseRestGet<{ id: string; display_name: string; linked_user_id: string | null; created_at: string }[]>(
      `/organization_staff_profiles?select=id,display_name,linked_user_id,created_at&organization_id=eq.${encodeURIComponent(orgId)}`
    ),
    listOrgStaffContactEmails(orgId),
  ]);
  return [
    ...members,
    ...[...contacts].filter(([userId]) => !members.some((member) => member.userId === userId)).map(([userId, email]): OrgMember => ({
      organizationId: orgId, userId, email, displayName: "", roleLevel: 10, createdAt: "", lastAccessAt: null,
    })),
    ...profiles.filter((profile) => !profile.linked_user_id).map((profile): OrgMember => ({
      organizationId: orgId, userId: `staff-profile:${profile.id}`,
      staffProfileId: profile.id, isPlaceholder: true, roleLevel: 10,
      displayName: profile.display_name, createdAt: profile.created_at,
      email: null, lastAccessAt: null,
    })),
  ];
};

/** Existing staff links also identify imported professionals outside the account directory. */
export const mergeOrgStaffCandidates = (organizationId: string, members: OrgMember[], staff: ClassStaffAssignment[]): OrgMember[] => {
  const staffUserIds = new Set(staff.map((assignment) => assignment.userId));
  const candidates = new Map(
    members
      .filter((member) => member.roleLevel >= 10 || staffUserIds.has(member.userId))
      .map((member) => [member.userId, member])
  );
  for (const assignment of staff) {
    const existing = candidates.get(assignment.userId);
    if (existing?.displayName?.trim() || !assignment.displayName?.trim()) continue;
    candidates.set(assignment.userId, {
      organizationId, userId: assignment.userId,
      staffProfileId: assignment.staffProfileId, isPlaceholder: assignment.isPlaceholder,
      displayName: assignment.displayName, roleLevel: 10,
      createdAt: "", email: existing?.email ?? null, lastAccessAt: null,
    });
  }
  return [...candidates.values()];
};

export const adminListOrgClasses = async (orgId: string): Promise<OrgClass[]> => {
  const rows = await supabaseRestPost<OrgClassRow[]>(
    "/rpc/admin_list_org_classes",
    { p_org_id: orgId },
    "return=representation"
  );
  return (rows ?? []).map(mapOrgClass);
};

export const adminListOrgMemberClassHeads = async (
  orgId: string
): Promise<MemberClassHead[]> => {
  const rows = await supabaseRestPost<MemberClassHeadRow[]>(
    "/rpc/admin_list_org_member_class_heads",
    { p_org_id: orgId },
    "return=representation"
  );
  return (rows ?? []).map(mapMemberClassHead);
};

export const adminListOrgMemberClassAssignments = async (
  orgId: string
): Promise<MemberClassAssignment[]> => {
  const rows = await supabaseRestPost<MemberClassAssignmentRow[]>(
    "/rpc/admin_list_org_member_class_assignments",
    { p_org_id: orgId },
    "return=representation"
  );
  return (rows ?? []).map(mapMemberClassAssignment);
};

export const adminSetMemberClassHeads = async (
  orgId: string,
  userId: string,
  classIds: string[]
): Promise<void> => {
  await supabaseRestPost<null>(
    "/rpc/admin_set_member_class_heads",
    {
      p_org_id: orgId,
      p_user_id: userId,
      p_class_ids: classIds,
    },
    "return=minimal"
  );
};

export const adminUpdateMemberRole = async (
  orgId: string,
  userId: string,
  newRoleLevel: 5 | 10 | 50
): Promise<void> => {
  await supabaseRestPost<null>(
    "/rpc/admin_update_member_role",
    {
      p_org_id: orgId,
      p_user_id: userId,
      p_new_role_level: newRoleLevel,
    },
    "return=minimal"
  );
};

export const adminRemoveOrgMember = async (
  orgId: string,
  userId: string
): Promise<void> => {
  await supabaseRestPost<null>(
    "/rpc/admin_remove_org_member",
    {
      p_org_id: orgId,
      p_user_id: userId,
    },
    "return=minimal"
  );
};

export const adminListMemberPermissions = async (
  orgId: string,
  userId: string
): Promise<MemberPermission[]> => {
  const rows = await supabaseRestPost<MemberPermissionRow[]>(
    "/rpc/admin_list_member_permissions",
    { p_org_id: orgId, p_user_id: userId },
    "return=representation"
  );
  return (rows ?? []).map(mapPermission);
};

export const adminSetMemberPermission = async (
  orgId: string,
  userId: string,
  permissionKey: MemberPermissionKey,
  isAllowed: boolean
): Promise<void> => {
  await supabaseRestPost<null>(
    "/rpc/admin_set_member_permission",
    {
      p_org_id: orgId,
      p_user_id: userId,
      p_permission_key: permissionKey,
      p_is_allowed: isAllowed,
    },
    "return=minimal"
  );
};

export const adminApplyMemberAccessChange = async ({
  organizationId,
  userId,
  roleLevel,
  classIds,
  permissionKeys,
  idempotencyKey,
}: {
  organizationId: string;
  userId: string;
  roleLevel: 5 | 10 | 50;
  classIds: string[];
  permissionKeys: MemberPermissionKey[];
  idempotencyKey: string;
}): Promise<MemberAccessChangeReceipt> => {
  const rows = await supabaseRestPost<MemberAccessChangeReceiptRow[]>(
    "/rpc/admin_apply_member_access_change_v2",
    {
      p_org_id: organizationId,
      p_user_id: userId,
      p_new_role_level: roleLevel,
      p_class_ids: classIds,
      p_permission_keys: permissionKeys,
      p_idempotency_key: idempotencyKey,
    },
    "return=representation"
  );
  const receipt = rows?.[0];
  if (!receipt) {
    throw new Error("O servidor não confirmou a atualização de acesso.");
  }
  return {
    receiptId: receipt.receipt_id,
    changed: Boolean(receipt.changed),
    roleLevel: receipt.role_level,
    classCount: Number(receipt.class_count ?? 0),
    permissionCount: Number(receipt.permission_count ?? 0),
    notificationId: receipt.notification_id ?? null,
    appliedAt: receipt.applied_at,
  };
};

export const getMyMemberPermissions = async (
  orgId: string
): Promise<MemberPermission[]> => {
  const rows = await supabaseRestPost<MemberPermissionRow[]>(
    "/rpc/get_my_member_permissions",
    { p_org_id: orgId },
    "return=representation"
  );
  return (rows ?? []).map(mapPermission);
};
