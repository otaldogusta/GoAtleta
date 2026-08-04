import { supabaseRestGet, supabaseRestRequest } from "./rest";

export type ClassSessionCoverageRole = "substitute" | "assistant" | "intern";
export type ClassSessionCoverageStatus = "pending" | "confirmed" | "declined" | "cancelled" | "completed";

export type ClassSessionCoverage = {
  id: string;
  organizationId: string;
  classId: string;
  sessionDate: string;
  absentUserId: string | null;
  replacementUserId: string | null;
  replacementRole: ClassSessionCoverageRole;
  status: ClassSessionCoverageStatus;
  reason: string | null;
  notes: string | null;
};

type CoverageRow = {
  id: string;
  organization_id: string;
  class_id: string;
  session_date: string;
  absent_user_id: string | null;
  replacement_user_id: string | null;
  replacement_role: ClassSessionCoverageRole;
  status: ClassSessionCoverageStatus;
  reason: string | null;
  notes: string | null;
};

const mapCoverage = (row: CoverageRow): ClassSessionCoverage => ({
  id: row.id,
  organizationId: row.organization_id,
  classId: row.class_id,
  sessionDate: row.session_date,
  absentUserId: row.absent_user_id,
  replacementUserId: row.replacement_user_id,
  replacementRole: row.replacement_role,
  status: row.status,
  reason: row.reason,
  notes: row.notes,
});

export async function listUpcomingClassSessionCoverages(
  organizationId: string,
  fromDate: string
): Promise<ClassSessionCoverage[]> {
  const rows = await supabaseRestGet<CoverageRow[]>(
    `/class_session_coverages?organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&session_date=gte.${encodeURIComponent(fromDate)}` +
      "&status=not.in.(cancelled,declined)&order=session_date.asc"
  );
  return (rows ?? []).map(mapCoverage);
}

export async function upsertClassSessionCoverage(input: {
  organizationId: string;
  classId: string;
  sessionDate: string;
  absentUserId?: string | null;
  replacementUserId?: string | null;
  replacementRole: ClassSessionCoverageRole;
  status: ClassSessionCoverageStatus;
  reason?: string | null;
  notes?: string | null;
}): Promise<ClassSessionCoverage> {
  const rows = await supabaseRestRequest<CoverageRow[]>(
    "/class_session_coverages?on_conflict=organization_id,class_id,session_date",
    {
      method: "POST",
      body: {
        organization_id: input.organizationId,
        class_id: input.classId,
        session_date: input.sessionDate,
        absent_user_id: input.absentUserId ?? null,
        replacement_user_id: input.replacementUserId ?? null,
        replacement_role: input.replacementRole,
        status: input.status,
        reason: input.reason?.trim() || null,
        notes: input.notes?.trim() || null,
        updated_by: null,
        updated_at: new Date().toISOString(),
      },
      additionalHeaders: { Prefer: "resolution=merge-duplicates,return=representation" },
    }
  );
  const row = rows?.[0];
  if (!row) throw new Error("Não foi possível salvar a cobertura da aula.");
  return mapCoverage(row);
}
