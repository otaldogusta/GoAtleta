import { assertSessionIdentity, getSessionIdentity } from "../auth/session";
import { supabaseGet } from "./client";

export type SessionReportSummary = {
  id: string;
  clientId: string | null;
  createdAt: string;
  activity: string;
  conclusion: string;
};

type SummaryRow = {
  id: string;
  client_id: string | null;
  createdat: string;
  activity: string | null;
  conclusion: string | null;
};

/** Read all lightweight summaries; photos are fetched only by the dated editor. */
export async function getClassReportHistory({
  classId, organizationId, userId, signal,
}: {
  classId: string;
  organizationId: string;
  userId: string;
  signal?: AbortSignal;
}): Promise<SessionReportSummary[]> {
  const identity = getSessionIdentity();
  if (!classId.trim() || !organizationId.trim() || !userId || identity.userId !== userId) {
    throw new Error("Não foi possível identificar a turma e a organização.");
  }
  const summaries = new Map<string, SessionReportSummary>();
  let offset = 0;
  while (true) {
    if (signal?.aborted) throw new Error("Consulta cancelada.");
    assertSessionIdentity(identity);
    const rows = await supabaseGet<SummaryRow[]>(
      `/session_logs?select=id,client_id,createdat,activity,conclusion&organization_id=eq.${encodeURIComponent(organizationId)}&classid=eq.${encodeURIComponent(classId)}&order=createdat.desc,id.desc&limit=100&offset=${offset}`,
      identity,
    );
    if (signal?.aborted) throw new Error("Consulta cancelada.");
    assertSessionIdentity(identity);
    // Continue to an empty page: the backend may cap pages below our limit.
    if (!rows.length) break;
    for (const row of rows) summaries.set(row.id, {
      id: row.id, clientId: row.client_id, createdAt: row.createdat,
      activity: row.activity ?? "", conclusion: row.conclusion ?? "",
    });
    offset += rows.length;
  }
  return [...summaries.values()];
}
