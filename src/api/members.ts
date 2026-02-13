import { supabaseRestPost } from "./rest";

export type OrgMember = {
  organizationId: string;
  userId: string;
  roleLevel: number;
  createdAt: string;
  displayName: string;
  email: string | null;
};

export type OrgClass = {
  id: string;
  name: string;
  unit: string;
};

export type MemberClassHead = {
  userId: string;
  classId: string;
  className: string;
  unit: string;
};

type OrgMemberRow = {
  organization_id: string;
  user_id: string;
  role_level: number;
  created_at: string;
  display_name?: string | null;
  email?: string | null;
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

const mapMember = (row: OrgMemberRow): OrgMember => ({
  organizationId: row.organization_id,
  userId: row.user_id,
  roleLevel: row.role_level,
  createdAt: row.created_at,
  displayName: row.display_name || row.email || row.user_id,
  email: row.email ?? null,
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
  | "org_members";

export type MemberPermission = {
  permissionKey: MemberPermissionKey;
  isAllowed: boolean;
};

type MemberPermissionRow = {
  permission_key: MemberPermissionKey;
  is_allowed: boolean;
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
    description: "Acessar calend\u00e1rio semanal.",
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
