import { createClientId } from "../core/client-id";
import { supabaseRestGet, supabaseRestPost } from "./rest";

export type ClassStaffTimelineStatus = "scheduled" | "active" | "away" | "completed" | "cancelled";

export type ClassStaffTenure = {
  id: string;
  organizationId: string;
  classId: string;
  userId: string | null;
  staffProfileId: string | null;
  displayName: string;
  staffRole: "head" | "assistant" | "intern";
  status: ClassStaffTimelineStatus;
  startsOn: string;
  endsOn: string | null;
  datePrecision: "exact" | "estimated";
  reason: string | null;
  notes: string | null;
};

export type ClassStaffSubstitution = {
  id: string;
  organizationId: string;
  classId: string;
  absentTenureId: string;
  absentUserId: string | null;
  replacementUserId: string | null;
  replacementStaffProfileId: string | null;
  replacementName: string;
  startsOn: string;
  endsOn: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
  reason: string | null;
  notes: string | null;
};

export type ClassTransitionEvidence = {
  period?: { starts_on?: string; ends_on?: string };
  absent_user_id?: string | null;
  replacement_user_id?: string | null;
  replacement_name?: string;
  counts?: { sessions?: number; attendance?: number; plans?: number; scouting?: number };
  recurring_focuses?: string[];
  source_references?: { type: string; id: string; date?: string }[];
  scope_rule?: string;
};

export type ClassTransitionSummaryRevision = {
  id: string;
  summaryId: string;
  previousSummary: string;
  revisedSummary: string;
  reason: string;
  revisedBy: string;
  createdAt: string;
};

export type ClassTransitionSummary = {
  id: string;
  organizationId: string;
  classId: string;
  substitutionId: string;
  evidence: ClassTransitionEvidence;
  generatedSummary: string;
  currentSummary: string;
  evidenceCount: number;
  confidence: number;
  generationStatus: "pending" | "generated" | "insufficient_evidence" | "failed";
  generatedAt: string | null;
};

export type ClassStaffTimelineEvent =
  | { kind: "tenure"; occurredOn: string; tenure: ClassStaffTenure }
  | { kind: "substitution"; occurredOn: string; substitution: ClassStaffSubstitution }
  | { kind: "transition_summary"; occurredOn: string; summary: ClassTransitionSummary };

type TenureRow = {
  id: string; organization_id: string; class_id: string; user_id: string | null;
  staff_profile_id: string | null; display_name_snapshot: string;
  staff_role: ClassStaffTenure["staffRole"]; status: ClassStaffTimelineStatus;
  starts_on: string; ends_on: string | null; date_precision: ClassStaffTenure["datePrecision"];
  reason: string | null; notes: string | null;
};

type SubstitutionRow = {
  id: string; organization_id: string; class_id: string; absent_tenure_id: string;
  absent_user_id: string | null; replacement_user_id: string | null;
  replacement_staff_profile_id: string | null; replacement_name_snapshot: string;
  starts_on: string; ends_on: string; status: ClassStaffSubstitution["status"];
  reason: string | null; notes: string | null;
};

type SummaryRow = {
  id: string; organization_id: string; class_id: string; substitution_id: string;
  evidence: ClassTransitionEvidence | null; generated_summary: string; current_summary: string;
  evidence_count: number; confidence: number; generation_status: ClassTransitionSummary["generationStatus"];
  generated_at: string | null;
};

const mapTenure = (row: TenureRow): ClassStaffTenure => ({
  id: row.id, organizationId: row.organization_id, classId: row.class_id,
  userId: row.user_id, staffProfileId: row.staff_profile_id,
  displayName: row.display_name_snapshot, staffRole: row.staff_role, status: row.status,
  startsOn: row.starts_on, endsOn: row.ends_on, datePrecision: row.date_precision,
  reason: row.reason, notes: row.notes,
});

const mapSubstitution = (row: SubstitutionRow): ClassStaffSubstitution => ({
  id: row.id, organizationId: row.organization_id, classId: row.class_id,
  absentTenureId: row.absent_tenure_id, absentUserId: row.absent_user_id,
  replacementUserId: row.replacement_user_id,
  replacementStaffProfileId: row.replacement_staff_profile_id,
  replacementName: row.replacement_name_snapshot, startsOn: row.starts_on,
  endsOn: row.ends_on, status: row.status, reason: row.reason, notes: row.notes,
});

const mapSummary = (row: SummaryRow): ClassTransitionSummary => ({
  id: row.id, organizationId: row.organization_id, classId: row.class_id,
  substitutionId: row.substitution_id, evidence: row.evidence ?? {},
  generatedSummary: row.generated_summary, currentSummary: row.current_summary,
  evidenceCount: row.evidence_count, confidence: Number(row.confidence ?? 0),
  generationStatus: row.generation_status, generatedAt: row.generated_at,
});

export const isClassStaffHistoryUnavailable = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("PGRST202") ||
    message.includes("PGRST205") ||
    message.includes("42P01") ||
    message.includes("class_staff_tenures") ||
    message.includes("class_staff_versions") ||
    message.includes("admin_apply_class_staff_assignments_v2")
  );
};

export async function getClassStaffVersion(organizationId: string, classId: string): Promise<number> {
  const rows = await supabaseRestGet<{ version: number }[]>(
    `/class_staff_versions?select=version&organization_id=eq.${encodeURIComponent(organizationId)}&class_id=eq.${encodeURIComponent(classId)}&limit=1`
  );
  return Number(rows?.[0]?.version ?? 0);
}

export async function applyClassStaffAssignmentsWithHistory(input: {
  organizationId: string;
  classId: string;
  assignments: { userId: string | null; staffProfileId?: string | null; displayName?: string | null; isPlaceholder?: boolean; staffRole: "head" | "assistant" | "intern" }[];
  expectedVersion: number;
  idempotencyKey?: string;
}): Promise<{ classId: string; version: number; appliedAt: string }> {
  const idempotencyKey = input.idempotencyKey ?? createClientId();
  const payload = {
    p_org_id: input.organizationId,
    p_class_id: input.classId,
    p_assignments: input.assignments.map((assignment) => ({
      user_id: assignment.isPlaceholder ? null : assignment.userId,
      staff_profile_id: assignment.staffProfileId ?? null,
      display_name: assignment.isPlaceholder ? assignment.displayName?.trim() || null : null,
      staff_role: assignment.staffRole,
    })),
    p_expected_version: input.expectedVersion,
    p_idempotency_key: idempotencyKey,
  };
  let result: { class_id: string; version: number; applied_at: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      result = await supabaseRestPost<{ class_id: string; version: number; applied_at: string }>(
        "/rpc/admin_apply_class_staff_assignments_v2",
        payload,
        "return=representation"
      );
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      const transient = /failed to fetch|network request failed|fetch failed|networkerror|timed out|timeout/i.test(message);
      if (!transient || attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!result) throw new Error("Não foi possível atualizar a equipe da turma.");
  return {
    classId: result.class_id,
    version: Number(result.version),
    appliedAt: result.applied_at,
  };
}

export async function listClassStaffTimeline(organizationId: string, classId: string): Promise<{
  tenures: ClassStaffTenure[];
  substitutions: ClassStaffSubstitution[];
  summaries: ClassTransitionSummary[];
}> {
  const filter = `organization_id=eq.${encodeURIComponent(organizationId)}&class_id=eq.${encodeURIComponent(classId)}`;
  const [tenures, substitutions, summaries] = await Promise.all([
    supabaseRestGet<TenureRow[]>(`/class_staff_tenures?select=*&${filter}&order=starts_on.desc,created_at.desc`),
    supabaseRestGet<SubstitutionRow[]>(`/class_staff_substitutions?select=*&${filter}&order=starts_on.desc,created_at.desc`),
    supabaseRestGet<SummaryRow[]>(`/class_transition_summaries?select=*&${filter}&order=created_at.desc`),
  ]);
  return {
    tenures: (tenures ?? []).map(mapTenure),
    substitutions: (substitutions ?? []).map(mapSubstitution),
    summaries: (summaries ?? []).map(mapSummary),
  };
}

export async function scheduleClassStaffSubstitution(input: {
  organizationId: string; classId: string; absentTenureId: string;
  replacementUserId?: string | null; replacementStaffProfileId?: string | null;
  startsOn: string; endsOn: string; reason?: string | null; notes?: string | null;
}): Promise<string> {
  return supabaseRestPost<string>("/rpc/admin_schedule_class_substitution", {
    p_org_id: input.organizationId,
    p_class_id: input.classId,
    p_absent_tenure_id: input.absentTenureId,
    p_replacement_user_id: input.replacementUserId ?? null,
    p_replacement_staff_profile_id: input.replacementStaffProfileId ?? null,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_reason: input.reason?.trim() || null,
    p_notes: input.notes?.trim() || null,
  }, "return=representation");
}

export async function reviseClassTransitionSummary(input: {
  summaryId: string; revisedSummary: string; reason: string;
}): Promise<void> {
  await supabaseRestPost<null>("/rpc/revise_class_transition_summary", {
    p_summary_id: input.summaryId,
    p_revised_summary: input.revisedSummary.trim(),
    p_reason: input.reason.trim(),
  }, "return=minimal");
}

export async function cancelClassStaffSubstitution(input: {
  organizationId: string; substitutionId: string; reason: string;
}): Promise<void> {
  await supabaseRestPost<null>("/rpc/admin_cancel_class_substitution", {
    p_org_id: input.organizationId,
    p_substitution_id: input.substitutionId,
    p_reason: input.reason.trim(),
  }, "return=minimal");
}

export async function registerClassStaffReturn(input: {
  organizationId: string; substitutionId: string; returnedOn?: string; notes?: string | null;
}): Promise<void> {
  await supabaseRestPost<null>("/rpc/admin_register_class_staff_return", {
    p_org_id: input.organizationId,
    p_substitution_id: input.substitutionId,
    p_returned_on: input.returnedOn ?? new Date().toISOString().slice(0, 10),
    p_notes: input.notes?.trim() || null,
  }, "return=minimal");
}

export async function correctClassStaffTenureDates(input: {
  organizationId: string; tenureId: string; startsOn: string; endsOn?: string | null;
  datePrecision: "exact" | "estimated"; reason: string;
}): Promise<void> {
  await supabaseRestPost<null>("/rpc/admin_correct_class_staff_tenure_dates", {
    p_org_id: input.organizationId,
    p_tenure_id: input.tenureId,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn ?? null,
    p_date_precision: input.datePrecision,
    p_reason: input.reason.trim(),
  }, "return=minimal");
}
