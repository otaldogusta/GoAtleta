import { useRef, useState } from "react";
import type { AthleteRequestCandidate } from "../../api/athlete-access-request";
import { approveFamilyRegistration, familyAccessErrorMessage, listFamilyRequestCandidates, reviewFamilyAccessRequest } from "../../api/family-access-request";

export function useAthleteAccessReview(requestId: string, onRefresh: () => void | Promise<void>) {
  const [candidates, setCandidates] = useState<AthleteRequestCandidate[] | null>(null);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<"loading" | "approved" | "rejected" | null>(null);
  const [error, setError] = useState("");
  const lock = useRef(false);
  // Stable per decision/payload, including retries after an uncertain network response.
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const run = async (nextAction: "loading" | "approved" | "rejected", operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setAction(nextAction); setError("");
    try { await operation(); }
    catch (cause) { setError(familyAccessErrorMessage(cause)); }
    finally { lock.current = false; setBusy(false); setAction(null); }
  };
  return {
    candidates, studentIds, busy, action, error,
    setStudentIds: (ids: string[]) => { setStudentIds(ids); setError(""); },
    load: () => run("loading", async () => {
      const rows = await listFamilyRequestCandidates(requestId);
      setCandidates(rows);
      setStudentIds((ids) => ids.filter((id) => rows.some((row) => row.id === id)));
    }),
    review: (decision: "approved" | "rejected", createKey: () => string) => run(decision, async () => {
      const studentId = decision === "approved" ? studentIds[0] : null;
      const payload = `${decision}:${studentId ?? ""}`;
      if (attempt.current?.payload !== payload) attempt.current = { payload, key: createKey() };
      if (decision === "approved" && !studentId) {
        await approveFamilyRegistration(requestId, attempt.current.key);
      } else {
        await reviewFamilyAccessRequest(requestId, decision, studentId, attempt.current.key);
      }
      await onRefresh();
    }),
  };
}
