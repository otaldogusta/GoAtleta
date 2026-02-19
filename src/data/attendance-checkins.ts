import {
  queueNfcCheckinWrite,
  type NfcCheckinPendingPayload,
} from "../db/seed";
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

export type CheckinDeliveryStatus = "synced" | "pending";

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

export const shouldQueueNfcCheckinError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("network request failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("fetch failed") ||
    lower.includes("timed out") ||
    /\s5\d{2}\s/.test(message) ||
    message.includes(" 429 ")
  );
};

const buildPendingPayload = (params: {
  organizationId: string;
  classId?: string | null;
  studentId: string;
  tagUid: string;
  checkedInAt?: string;
}): NfcCheckinPendingPayload => {
  const checkedInAt = params.checkedInAt ?? new Date().toISOString();
  const localRef = `queue_nfc_${Date.now()}_${params.tagUid}`;
  return {
    organizationId: params.organizationId,
    classId: params.classId ?? null,
    studentId: params.studentId,
    tagUid: params.tagUid,
    checkedInAt,
    localRef,
  };
};

const insertCheckin = async (params: {
  organizationId: string;
  classId?: string | null;
  studentId: string;
  tagUid: string;
  checkedInAt?: string;
}): Promise<AttendanceCheckin> => {
  const rows = await supabaseRestPost<AttendanceCheckinRow[]>(
    "/attendance_checkins",
    [
      {
        organization_id: params.organizationId,
        class_id: params.classId ?? null,
        student_id: params.studentId,
        tag_uid: params.tagUid,
        source: "nfc",
        checked_in_at: params.checkedInAt ?? new Date().toISOString(),
      },
    ],
    "return=representation"
  );
  if (!rows.length) throw new Error("Falha ao registrar check-in NFC.");
  return mapRow(rows[0]);
};

export async function queueNfcCheckin(params: {
  organizationId: string;
  classId?: string | null;
  studentId: string;
  tagUid: string;
  checkedInAt?: string;
}) {
  const payload = buildPendingPayload(params);
  await queueNfcCheckinWrite(payload);
  return payload;
}

export async function createCheckin(params: {
  organizationId: string;
  classId?: string | null;
  studentId: string;
  tagUid: string;
  checkedInAt?: string;
}): Promise<AttendanceCheckin> {
  return insertCheckin(params);
}

export async function createCheckinWithFallback(params: {
  organizationId: string;
  classId?: string | null;
  studentId: string;
  tagUid: string;
  checkedInAt?: string;
}): Promise<{ checkin: AttendanceCheckin; status: CheckinDeliveryStatus }> {
  try {
    const checkin = await insertCheckin(params);
    return { checkin, status: "synced" };
  } catch (error) {
    if (!shouldQueueNfcCheckinError(error)) {
      throw error;
    }

    const pendingPayload = await queueNfcCheckin(params);
    const checkin: AttendanceCheckin = {
      id: pendingPayload.localRef,
      organizationId: pendingPayload.organizationId,
      classId: pendingPayload.classId ?? null,
      studentId: pendingPayload.studentId,
      tagUid: pendingPayload.tagUid,
      source: "nfc",
      checkedInAt: pendingPayload.checkedInAt,
    };
    return { checkin, status: "pending" };
  }
}
