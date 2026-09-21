import { supabaseRestDelete, supabaseRestGet, supabaseRestPatch, supabaseRestPost } from "./rest";

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
  staffProfileId?: string | null;
  isPlaceholder?: boolean;
  staffRole: "head" | "assistant" | "intern";
  displayName?: string | null;
  photoUrl?: string | null;
};

export type OrganizationCoordinator = {
  userId: string;
};

export type ClassStaffDraftAssignment = Pick<ClassStaffAssignment, "userId" | "staffProfileId" | "staffRole" | "displayName" | "isPlaceholder">;

type ClassStaffAssignmentRow = {
  class_id: string;
  user_id: string | null;
  staff_profile_id?: string | null;
  staff_role: ClassStaffAssignment["staffRole"];
  display_name?: string | null;
  photo_url?: string | null;
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

  let rows: ClassStaffAssignmentRow[];
  try {
    rows = await supabaseRestGet<ClassStaffAssignmentRow[]>(
      `/class_staff?select=class_id,user_id,staff_profile_id,staff_role&organization_id=eq.${encodeURIComponent(
        organizationId
      )}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!message.includes("staff_profile_id") && !message.includes("42703")) throw error;
    rows = await supabaseRestGet<ClassStaffAssignmentRow[]>(
      `/class_staff?select=class_id,user_id,staff_role&organization_id=eq.${encodeURIComponent(
        organizationId
      )}`
    );
  }

  return (rows ?? [])
    .filter((row) => classIds.includes(row.class_id))
    .map((row) => ({
      classId: row.class_id,
      userId: row.user_id ?? `staff-profile:${row.staff_profile_id}`,
      staffProfileId: row.staff_profile_id ?? null,
      isPlaceholder: !row.user_id,
      staffRole: row.staff_role,
      displayName: row.display_name ?? null,
      photoUrl: row.photo_url ?? null,
    }));
}

const isMissingClassStaffIdentityRpc = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("PGRST202") ||
    message.includes("list_org_class_staff_for_classes")
  );
};

export async function listClassStaffIdentitiesByClassIds(params: {
  organizationId: string;
  classIds: string[];
}): Promise<ClassStaffAssignment[]> {
  const organizationId = String(params.organizationId ?? "").trim();
  const classIds = Array.from(
    new Set((params.classIds ?? []).map((value) => String(value ?? "").trim()).filter(Boolean))
  );
  if (!organizationId || !classIds.length) return [];

  try {
    const rows = await supabaseRestPost<ClassStaffAssignmentRow[]>(
      "/rpc/list_org_class_staff_for_classes",
      {
        p_org_id: organizationId,
        p_class_ids: classIds,
      },
      "return=representation"
    );
    return (rows ?? []).map((row) => ({
      classId: row.class_id,
      userId: row.user_id ?? `staff-profile:${row.staff_profile_id}`,
      staffProfileId: row.staff_profile_id ?? null,
      isPlaceholder: !row.user_id,
      staffRole: row.staff_role,
      displayName: row.display_name ?? null,
      photoUrl: row.photo_url ?? null,
    }));
  } catch (error) {
    if (!isMissingClassStaffIdentityRpc(error)) throw error;
    return listClassStaffByClassIds({ organizationId, classIds });
  }
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

const isMissingReplaceAssignmentsRpc = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("PGRST202") || message.includes("admin_replace_class_staff_assignments");
};

export async function replaceClassStaffAssignments(params: {
  organizationId: string;
  classId: string;
  assignments: ClassStaffDraftAssignment[];
}): Promise<void> {
  const organizationId = params.organizationId.trim();
  const classId = params.classId.trim();
  const assignments = Array.from(
    new Map(params.assignments.map((assignment) => [assignment.userId.trim(), {
      userId: assignment.userId.trim(),
      staffProfileId: assignment.staffProfileId?.trim() || null,
      displayName: assignment.displayName?.trim() || null,
      isPlaceholder: Boolean(assignment.isPlaceholder),
      staffRole: assignment.staffRole,
    }])).values()
  ).filter((assignment) => assignment.userId);
  if (!organizationId || !classId) throw new Error("Turma ou organização inválida.");
  if (assignments.filter((assignment) => assignment.staffRole === "head").length > 1) {
    throw new Error("Selecione apenas um professor responsável.");
  }

  try {
    await supabaseRestPost<null>(
      "/rpc/admin_replace_class_staff_assignments",
      {
        p_org_id: organizationId,
        p_class_id: classId,
        p_assignments: assignments.map((assignment) => ({
          user_id: assignment.isPlaceholder ? null : assignment.userId,
          staff_profile_id: assignment.staffProfileId,
          display_name: assignment.isPlaceholder ? assignment.displayName : null,
          staff_role: assignment.staffRole,
        })),
      },
      "return=minimal"
    );
    return;
  } catch (error) {
    if (!isMissingReplaceAssignmentsRpc(error)) throw error;
    if (assignments.some((assignment) => assignment.isPlaceholder)) {
      throw new Error("O pré-cadastro de profissionais requer a atualização mais recente do banco.");
    }
  }

  const filter = `organization_id=eq.${encodeURIComponent(organizationId)}&class_id=eq.${encodeURIComponent(classId)}`;
  const previous = await supabaseRestGet<ClassStaffAssignmentRow[]>(
    `/class_staff?select=class_id,user_id,staff_role&${filter}`
  );
  const restore = async () => {
    await supabaseRestDelete<null>(`/class_staff?${filter}`);
    if (previous.length) {
      await supabaseRestPost<null>(
        "/class_staff",
        previous.map((row) => ({
          organization_id: organizationId,
          class_id: classId,
          user_id: row.user_id,
          staff_role: row.staff_role,
        })),
        "return=minimal"
      );
    }
  };

  try {
    await supabaseRestDelete<null>(`/class_staff?${filter}`);
    if (assignments.length) {
      await supabaseRestPost<null>(
        "/class_staff",
        assignments.map((assignment) => ({
          organization_id: organizationId,
          class_id: classId,
          user_id: assignment.userId,
          staff_role: assignment.staffRole,
        })),
        "return=minimal"
      );
    }
    const head = assignments.find((assignment) => assignment.staffRole === "head");
    await supabaseRestPatch<null>(
      `/classes?id=eq.${encodeURIComponent(classId)}&organization_id=eq.${encodeURIComponent(organizationId)}`,
      { owner_id: head?.userId ?? null },
      "return=minimal"
    );
  } catch (error) {
    try {
      await restore();
    } catch {
      // Preserve the original error; the next reload will expose the server truth.
    }
    throw error;
  }
}
