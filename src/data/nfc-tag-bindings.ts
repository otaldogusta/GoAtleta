import { supabaseRestGet, supabaseRestPost } from "../api/rest";

export type NfcTagBinding = {
  id: string;
  organizationId: string;
  tagUid: string;
  bindingType: "student";
  studentId: string;
  createdBy: string;
  createdAt: string;
};

type NfcTagBindingRow = {
  id: string;
  organization_id: string;
  tag_uid: string;
  binding_type: "student";
  student_id: string;
  created_by: string;
  created_at: string;
};

const mapBindingRow = (row: NfcTagBindingRow): NfcTagBinding => ({
  id: row.id,
  organizationId: row.organization_id,
  tagUid: row.tag_uid,
  bindingType: row.binding_type,
  studentId: row.student_id,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

export async function getBinding(
  organizationId: string,
  tagUid: string
): Promise<NfcTagBinding | null> {
  if (!organizationId || !tagUid) return null;
  const rows = await supabaseRestGet<NfcTagBindingRow[]>(
    "/nfc_tag_bindings?select=*&organization_id=eq." +
      encodeURIComponent(organizationId) +
      "&tag_uid=eq." +
      encodeURIComponent(tagUid) +
      "&limit=1"
  );
  if (!rows.length) return null;
  return mapBindingRow(rows[0]);
}

export async function createBinding(params: {
  organizationId: string;
  tagUid: string;
  studentId: string;
  createdBy: string;
}): Promise<NfcTagBinding> {
  try {
    const rows = await supabaseRestPost<NfcTagBindingRow[]>(
      "/nfc_tag_bindings",
      [
        {
          organization_id: params.organizationId,
          tag_uid: params.tagUid,
          binding_type: "student",
          student_id: params.studentId,
          created_by: params.createdBy,
        },
      ],
      "return=representation"
    );
    if (!rows.length) throw new Error("Falha ao vincular tag NFC.");
    return mapBindingRow(rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    const lower = message.toLowerCase();
    if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
      throw new Error("Esta tag ja esta vinculada para esta organizacao.");
    }
    throw error;
  }
}
