import { supabaseRestPost } from "./rest";

type ClassHeadRow = {
  class_id: string;
  user_id: string;
  class_name: string;
  unit: string;
  display_name?: string | null;
  email?: string | null;
};

export type ClassResponsible = {
  classId: string;
  userId: string;
  className: string;
  unit: string;
  displayName: string;
  email: string | null;
};

const mapClassHead = (row: ClassHeadRow): ClassResponsible => ({
  classId: row.class_id,
  userId: row.user_id,
  className: row.class_name,
  unit: row.unit,
  displayName: row.display_name || row.email || row.user_id,
  email: row.email ?? null,
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
    "/rpc/admin_list_class_heads_for_classes",
    {
      p_org_id: organizationId,
      p_class_ids: classIds,
    },
    "return=representation"
  );
  return (rows ?? []).map(mapClassHead);
}
