import { supabaseRestGet, supabaseRestPost } from "./rest";

type ClassHeadRow = {
  class_id: string;
  user_id: string;
  class_name: string;
  unit: string;
  display_name?: string | null;
  email?: string | null;
  photo_url?: string | null;
};

export type ClassResponsible = {
  classId: string;
  userId: string;
  className: string;
  unit: string;
  displayName: string;
  email: string | null;
  photoUrl: string | null;
};

export type ClassStaffAssignment = {
  classId: string;
  userId: string;
  staffRole: "head" | "assistant" | "intern";
};

export type OrganizationCoordinator = {
  userId: string;
};

type ClassStaffAssignmentRow = {
  class_id: string;
  user_id: string;
  staff_role: ClassStaffAssignment["staffRole"];
};

type OrganizationCoordinatorRow = {
  user_id: string;
};

const mapClassHead = (row: ClassHeadRow): ClassResponsible => ({
  classId: row.class_id,
  userId: row.user_id,
  className: row.class_name,
  unit: row.unit,
  displayName: row.display_name || row.email || row.user_id,
  email: row.email ?? null,
  photoUrl: row.photo_url ?? null,
});

export async function listClassHeadsByClassIds(params: {
  organizationId: string;
  classIds: string[];
}): Promise<ClassResponsible[]> {
  const organizationId = String(params.organizationId ?? "").trim();
  const classIds = Array.from(
    new Set((params.classIds ?? []).map((value) => String(value ?? "").trim()).filter(Boolean))
  );
  if (!organizationId || !classIds.length) return [];

  const rows = await supabaseRestPost<ClassHeadRow[]>(
    "/rpc/list_org_class_heads_for_classes",
    {
      p_org_id: organizationId,
      p_class_ids: classIds,
    },
    "return=representation"
  );
  return (rows ?? []).map(mapClassHead);
}

export async function listClassStaffByClassIds(params: {
  organizationId: string;
  classIds: string[];
}): Promise<ClassStaffAssignment[]> {
  const organizationId = String(params.organizationId ?? "").trim();
  const classIds = Array.from(
    new Set((params.classIds ?? []).map((value) => String(value ?? "").trim()).filter(Boolean))
  );
  if (!organizationId || !classIds.length) return [];

  const rows = await supabaseRestGet<ClassStaffAssignmentRow[]>(
    `/class_staff?select=class_id,user_id,staff_role&organization_id=eq.${encodeURIComponent(
      organizationId
    )}`
  );

  return (rows ?? [])
    .filter((row) => classIds.includes(row.class_id))
    .map((row) => ({
      classId: row.class_id,
      userId: row.user_id,
      staffRole: row.staff_role,
    }));
}

export async function listOrganizationCoordinators(
  organizationIdInput: string
): Promise<OrganizationCoordinator[]> {
  const organizationId = String(organizationIdInput ?? "").trim();
  if (!organizationId) return [];

  const rows = await supabaseRestGet<OrganizationCoordinatorRow[]>(
    `/organization_members?select=user_id&organization_id=eq.${encodeURIComponent(
      organizationId
    )}&role_level=gte.50`
  );

  return (rows ?? []).map((row) => ({ userId: row.user_id }));
}
