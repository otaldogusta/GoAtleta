import { supabaseRestPost } from "../api/rest";

export type AttendanceCheckin = {
  id: string;
  organizationId: string;
  classId: string | null;
  studentId: string;
  tagUid: string;
  source: "nfc";
  checkedInAt: string;
};

type AttendanceCheckinRow = {
  id: string;
  organization_id: string;
  class_id: string | null;
  student_id: string;
  tag_uid: string;
  source: "nfc";
  checked_in_at: string;
};

const mapRow = (row: AttendanceCheckinRow): AttendanceCheckin => ({
  id: row.id,
  organizationId: row.organization_id,
  classId: row.class_id,
  studentId: row.student_id,
  tagUid: row.tag_uid,
  source: row.source,
  checkedInAt: row.checked_in_at,
});

export async function createCheckin(params: {
  organizationId: string;
  classId?: string | null;
  studentId: string;
  tagUid: string;
}): Promise<AttendanceCheckin> {
  const rows = await supabaseRestPost<AttendanceCheckinRow[]>(
    "/attendance_checkins",
    [
      {
        organization_id: params.organizationId,
        class_id: params.classId ?? null,
        student_id: params.studentId,
        tag_uid: params.tagUid,
        source: "nfc",
      },
    ],
    "return=representation"
  );
  if (!rows.length) throw new Error("Falha ao registrar check-in NFC.");
  return mapRow(rows[0]);
}
