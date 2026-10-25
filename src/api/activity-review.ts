import { supabaseRestGet, supabaseRestPost } from "./rest";
import type { ActivityReview } from "../core/activity-review";
import { assertSessionIdentity, getSessionIdentity } from "../auth/session";
export type ActivityReviewReason = "recess" | "suspended" | "held" | "holiday" | "tournament" | "other";
export type ActivityReviewDetails = { note: string; resolution: "replaced" | "rescheduled" | null; newDate: string };
function scope(id: string) { if (!id.trim()) throw new Error("Missing organizationId"); return encodeURIComponent(id); }
type ActivityDay = { classid: string; date: string };
type ActivityContext = { attendance: ActivityDay[]; reviews: ActivityReview[]; enrolledClassIds: string[] };
const quotedFilter = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

// Stop stale background pagination when its consumer is disposed or identity changes.
// A failed/incomplete read must never produce a missing-attendance suggestion.
export async function loadActivityReview(organizationId: string, today: string, signal?: AbortSignal) {
  const since = new Date(`${today}T12:00:00Z`); since.setUTCDate(since.getUTCDate() - 28);
  const org = scope(organizationId);
  const identity = getSessionIdentity();
  const assertCurrent = () => {
    assertSessionIdentity(identity);
    if (signal?.aborted) throw new Error("Activity review read cancelled");
  };
  assertCurrent();
  try {
    const data = await supabaseRestGet<ActivityContext>(
      `/rpc/get_activity_review_context_v1?p_organization_id=${org}&p_today=${encodeURIComponent(today)}`,
      assertCurrent,
    );
    assertCurrent();
    if (!data || !Array.isArray(data.attendance) || !Array.isArray(data.reviews) ||
      !Array.isArray(data.enrolledClassIds) || data.enrolledClassIds.some(id => typeof id !== "string") ||
      data.attendance.some(row => !row || typeof row.classid !== "string" || typeof row.date !== "string") ||
      data.reviews.some(row => !row || !Array.isArray(row.class_ids) ||
        row.class_ids.some(id => typeof id !== "string") || typeof row.start_date !== "string" || typeof row.end_date !== "string")) {
      throw new Error("Invalid activity review context");
    }
    return { ...data, enrolledClassIds: new Set(data.enrolledClassIds) };
  } catch (error) {
    assertCurrent();
    // Older backends keep the same read-only flow until the additive RPC is activated.
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("get_activity_review_context_v1") || !/PGRST202|42883/.test(message)) throw error;
  }
  const enrolledClassIds = new Set<string>();
  const seenStudents = new Set<string>();
  let studentCursor = "";
  for (let request = 0; ; request += 1) {
    if (request >= 1000) throw new Error("Enrollment window too large for a reliable suggestion");
    const after = studentCursor ? `&id=gt.${encodeURIComponent(studentCursor)}` : "";
    const rows = await supabaseRestGet<{id:string; classid:string}[]>(`/students?organization_id=eq.${org}&select=id,classid&order=id.asc&limit=500${after}`, assertCurrent);
    if (!rows.length) break;
    for (const row of rows) {
      if (!row.id || seenStudents.has(row.id)) throw new Error("Incomplete activity enrollment read");
      seenStudents.add(row.id);
    }
    rows.forEach(row => { if (row.classid) enrolledClassIds.add(row.classid); });
    studentCursor = rows[rows.length - 1].id;
  }
  const attendance: ActivityDay[] = [];
  const seenAttendance = new Set<string>();
  const seenDays = new Set<string>();
  let cursor: { id: string; date: string } | null = null;
  for (let request = 0; ; request += 1) {
    if (request >= 1000) throw new Error("Attendance window too large for a reliable suggestion");
    const cursorFilter = cursor ? `&or=${encodeURIComponent(`(date.gt.${quotedFilter(cursor.date)},and(date.eq.${quotedFilter(cursor.date)},id.gt.${quotedFilter(cursor.id)}))`)}` : "";
    const lowerDate = cursor?.date ?? since.toISOString().slice(0, 10);
    const rows: { id: string; classid: string; date: string }[] = await supabaseRestGet(`/attendance_logs?organization_id=eq.${org}&date=gte.${encodeURIComponent(lowerDate)}&date=lt.${encodeURIComponent(today)}&select=id,classid,date&order=date.asc,id.asc&limit=500${cursorFilter}`, assertCurrent);
    if (!rows.length) break;
    for (const row of rows) {
      if (!row.id || !row.date || seenAttendance.has(row.id)) throw new Error("Incomplete activity attendance read");
      seenAttendance.add(row.id);
      const key = JSON.stringify([row.classid, row.date]);
      if (!seenDays.has(key)) {
        seenDays.add(key);
        attendance.push({ classid: row.classid, date: row.date });
      }
    }
    cursor = rows[rows.length - 1];
  }
  const reviews: ActivityReview[] = [];
  const seenReviews = new Set<string>();
  let reviewCursor = "";
  for (let request = 0; ; request += 1) {
    if (request >= 1000) throw new Error("Review window too large for a reliable suggestion");
    const after = reviewCursor ? `&id=gt.${encodeURIComponent(reviewCursor)}` : "";
    const rows = await supabaseRestGet<(ActivityReview & { id: string })[]>(`/organization_activity_reviews?organization_id=eq.${org}&end_date=gte.${since.toISOString().slice(0, 10)}&select=id,class_ids,start_date,end_date&order=id.asc&limit=500${after}`, assertCurrent);
    if (!rows.length) break;
    for (const row of rows) {
      if (!row.id || seenReviews.has(row.id)) throw new Error("Incomplete activity reviews read");
      seenReviews.add(row.id);
      reviews.push({ class_ids: row.class_ids, start_date: row.start_date, end_date: row.end_date });
    }
    reviewCursor = rows[rows.length - 1].id;
  }
  assertCurrent();
  return { attendance, reviews, enrolledClassIds };
}
export function saveActivityReview(organizationId: string, classIds: string[], start: string, end: string, reason: ActivityReviewReason, details?: ActivityReviewDetails) {
  scope(organizationId);
  if (details) return supabaseRestPost("/rpc/review_organization_activity_details", { p_organization_id: organizationId, p_class_ids: classIds, p_start: start, p_end: end, p_reason: reason, p_note: details.note, p_resolution: details.resolution, p_new_date: details.newDate || null });
  return supabaseRestPost("/rpc/review_organization_activity", { p_organization_id: organizationId, p_class_ids: classIds, p_start: start, p_end: end, p_reason: reason });
}
