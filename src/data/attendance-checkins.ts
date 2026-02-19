import {
  queueNfcCheckinWrite,
  type NfcCheckinPendingPayload,
} from "../db/seed";
import { supabaseRestGet, supabaseRestRequest } from "../api/rest";

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
  idempotency_key?: string;
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

const extractIsoDate = (value?: string) => {
  const parsed = Date.parse(value ?? "");
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
};

export const buildCheckinIdempotencyKey = (params: {
  organizationId: string;
  classId?: string | null;
  studentId: string;
  checkedInAt?: string;
}) =>
  `${params.organizationId}:${params.classId ?? "__none__"}:${params.studentId}:${extractIsoDate(
    params.checkedInAt
  )}`;

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
  const checkedInAt = params.checkedInAt ?? new Date().toISOString();
  const idempotencyKey = buildCheckinIdempotencyKey({
    organizationId: params.organizationId,
    classId: params.classId ?? null,
    studentId: params.studentId,
    checkedInAt,
  });
  const rows = await supabaseRestRequest<AttendanceCheckinRow[]>(
    `/attendance_checkins?on_conflict=${encodeURIComponent("idempotency_key")}`,
    {
      method: "POST",
      body: [
        {
          organization_id: params.organizationId,
          class_id: params.classId ?? null,
          student_id: params.studentId,
          tag_uid: params.tagUid,
          source: "nfc",
          checked_in_at: checkedInAt,
          idempotency_key: idempotencyKey,
        },
      ],
      prefer: "return=representation",
      additionalHeaders: {
        Prefer: "resolution=ignore-duplicates,return=representation",
      },
    }
  );
  if (rows.length) return mapRow(rows[0]);

  const existing = await supabaseRestGet<AttendanceCheckinRow[]>(
    "/attendance_checkins?select=*&idempotency_key=eq." +
      encodeURIComponent(idempotencyKey) +
      "&limit=1"
  );
  if (existing.length) return mapRow(existing[0]);

  throw new Error("Falha ao registrar check-in NFC.");
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

export async function listCheckinsByRange(params: {
  organizationId: string;
  classId?: string;
  fromIso: string;
  toIso?: string;
  limit?: number;
}): Promise<AttendanceCheckin[]> {
  const limit = Math.max(1, params.limit ?? 1000);
  const clauses = [
    "select=*",
    `organization_id=eq.${encodeURIComponent(params.organizationId)}`,
    `checked_in_at=gte.${encodeURIComponent(params.fromIso)}`,
    `order=checked_in_at.desc`,
    `limit=${limit}`,
  ];

  if (params.classId) {
    clauses.push(`class_id=eq.${encodeURIComponent(params.classId)}`);
  }

  if (params.toIso) {
    clauses.push(`checked_in_at=lt.${encodeURIComponent(params.toIso)}`);
  }

  const rows = await supabaseRestGet<AttendanceCheckinRow[]>(
    `/attendance_checkins?${clauses.join("&")}`
  );
  return rows.map(mapRow);
}
