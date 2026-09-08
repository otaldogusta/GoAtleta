import { supabaseRestGet, supabaseRestPost } from "./rest";
import type { ActivityReview } from "../core/activity-review";
export type ActivityReviewReason = "recess" | "suspended" | "held" | "holiday" | "tournament" | "other";
export type ActivityReviewDetails = { note: string; resolution: "replaced" | "rescheduled" | null; newDate: string };
function scope(id: string) { if (!id.trim()) throw new Error("Missing organizationId"); return encodeURIComponent(id); }
export async function loadActivityReview(organizationId: string, today: string) {
  const since = new Date(`${today}T12:00:00Z`); since.setUTCDate(since.getUTCDate() - 28);
  const org = scope(organizationId);
  const enrolledClassIds = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const rows = await supabaseRestGet<{classid:string}[]>(`/students?organization_id=eq.${org}&select=classid&order=id.asc&limit=500&offset=${offset}`);
    rows.forEach(row => { if (row.classid) enrolledClassIds.add(row.classid); });
    if (rows.length < 500) break;
    if (offset >= 49500) throw new Error("Enrollment window too large for a reliable suggestion");
  }
  // Paginate: a partial attendance response must never become a false missing-call alert.
  const attendance: { classid: string; date: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const rows = await supabaseRestGet<{ classid: string; date: string }[]>(`/attendance_logs?organization_id=eq.${org}&date=gte.${since.toISOString().slice(0, 10)}&date=lt.${today}&select=classid,date&order=id.asc&limit=500&offset=${offset}`);
    attendance.push(...rows);
    if (rows.length < 500) break;
    if (offset >= 49500) throw new Error("Attendance window too large for a reliable suggestion");
  }
  const reviews = await supabaseRestGet<ActivityReview[]>(`/organization_activity_reviews?organization_id=eq.${org}&end_date=gte.${since.toISOString().slice(0, 10)}&select=class_ids,start_date,end_date`);
  return { attendance, reviews, enrolledClassIds };
}
export function saveActivityReview(organizationId: string, classIds: string[], start: string, end: string, reason: ActivityReviewReason, details?: ActivityReviewDetails) {
  scope(organizationId);
  if (details) return supabaseRestPost("/rpc/review_organization_activity_details", { p_organization_id: organizationId, p_class_ids: classIds, p_start: start, p_end: end, p_reason: reason, p_note: details.note, p_resolution: details.resolution, p_new_date: details.newDate || null });
  return supabaseRestPost("/rpc/review_organization_activity", { p_organization_id: organizationId, p_class_ids: classIds, p_start: start, p_end: end, p_reason: reason });
}
