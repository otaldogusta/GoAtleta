import { clearAttendanceDraftIfCurrent, listOfflineAttendanceDrafts, markAttendanceDraftConflict } from "./attendance-draft";
import { supabasePost } from "./client";
import { getPendingAttendanceRecords } from "./pending-attendance";
import { capturePendingWriteContext } from "./pending-write-identity";
import { refreshSessionFromSyncedAttendance } from "./students";

export async function flushOfflineAttendanceDrafts() {
  let flushed = 0;
  for (const draft of await listOfflineAttendanceDrafts()) {
    const context = await capturePendingWriteContext(undefined, draft.origin);
    if (await getPendingAttendanceRecords(draft.classId, draft.date)) continue;
    try {
      await supabasePost("/rpc/apply_attendance_draft", {
        p_org_id: context.origin.organizationId,
        p_class_id: draft.classId,
        p_date: draft.date,
        p_edits: draft.edits.map(({ studentId, before, after }) => ({ studentId, before, after })),
      }, undefined, context.identity);
    } catch (error) {
      if (error instanceof Error && /^Supabase POST error: (400|403|409)\b/.test(error.message)) {
        await markAttendanceDraftConflict(draft);
        continue;
      }
      throw error;
    }
    await clearAttendanceDraftIfCurrent(draft);
    flushed += 1;
    await refreshSessionFromSyncedAttendance(draft.classId, draft.date, context).catch(() => undefined);
  }
  return flushed;
}
