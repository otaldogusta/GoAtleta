import { supabaseRestPost } from "./rest";

export type AthleteRequestCandidate = { id: string; name: string; class_name: string; class_days?: number[] | null; class_start_time?: string | null };

export async function requestAthleteAccess(organizationId: string) {
  const id = await supabaseRestPost<string>("/rpc/request_athlete_access", { p_org_id: organizationId });
  if (!id) throw new Error("O servidor não confirmou a solicitação.");
  return id;
}

export function listAthleteRequestCandidates(requestId: string) {
  return supabaseRestPost<AthleteRequestCandidate[]>("/rpc/list_athlete_request_candidates", { p_request_id: requestId });
}

export async function reviewAthleteAccessRequest(requestId: string, decision: "approved" | "rejected", studentId: string | null, idempotencyKey: string) {
  const result = await supabaseRestPost<boolean>("/rpc/review_athlete_access_request", {
    p_request_id: requestId, p_decision: decision, p_student_id: studentId, p_idempotency_key: idempotencyKey,
  });
  if (typeof result !== "boolean") throw new Error("O servidor não confirmou a revisão.");
}
