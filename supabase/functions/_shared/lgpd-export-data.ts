import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Explicit snapshot; every read uses the caller's JWT/RLS. Empty rows may mean
// RLS hides records. Never elevate these reads to fill those visibility gaps.
export const STUDENT_EXPORT_COLUMNS = [
  "id", "organization_id", "name", "student_user_id", "classid", "age",
  "birthdate", "phone", "login_email", "photo_url", "ra", "ra_start_year",
  "external_id", "cpf_masked", "rg", "college_course", "is_experimental",
  "membership_status", "inactivated_at", "inactivation_reason", "guardian_name",
  "guardian_phone", "guardian_relation", "address", "gender_identity",
  "health_issue", "health_issue_notes", "medication_use", "medication_notes",
  "health_observations", "position_primary", "position_secondary",
  "athlete_objective", "learning_style", "createdat",
].join(",");

export const STUDENT_EXPORT_DATASETS = [
  {
    key: "consents", table: "consents", subjectColumn: "student_id", organization: true,
    columns: "id,student_id,organization_id,purpose,legal_basis,granted,granted_at,revoked_at,version,document_hash,created_at,updated_at",
  },
  {
    key: "attendance", table: "attendance_checkins", subjectColumn: "student_id", organization: true,
    columns: "id,organization_id,class_id,student_id,source,checked_in_at",
  },
  {
    key: "attendance_logs", table: "attendance_logs", subjectColumn: "studentid", organization: true,
    columns: "id,organization_id,classid,studentid,date,status,note,pain_score,createdat",
  },
  {
    key: "training_attendance", table: "training_session_attendance", subjectColumn: "student_id", organization: true,
    columns: "id,organization_id,session_id,class_id,student_id,status,note,pain_score,created_at,updated_at",
  },
  {
    key: "intakes", table: "athlete_intakes", subjectColumn: "student_id", organization: true,
    columns: "id,organization_id,class_id,student_id,full_name,ra,sex,birth_date,email,modalities,parq_positive,cardio_risk,ortho_risk,current_injury,smoker,allergies,major_surgery,family_history_risk,dizziness_or_syncope,needs_medical_clearance,needs_individual_attention,jump_restriction,risk_status,tags,notes,created_at,updated_at",
  },
  {
    key: "scouting", table: "student_scouting_logs", subjectColumn: "studentid", organization: false,
    columns: "id,studentid,classid,date,serve_0,serve_1,serve_2,receive_0,receive_1,receive_2,set_0,set_1,set_2,attack_send_0,attack_send_1,attack_send_2,createdat,updatedat",
  },
  {
    key: "scouting_actions", table: "scouting_actions", subjectColumn: "student_id", organization: true,
    columns: "id,organization_id,session_id,classid,student_id,athlete_name,fundamental,phase,result_key,result_label,result_level,createdat,rally_event_id,contact_index,capture_zone,rubric_version",
  },
  {
    key: "enrollments", table: "student_class_enrollments", subjectColumn: "student_id", organization: true,
    columns: "id,organization_id,student_id,class_id,modality,status,created_at,updated_at",
  },
  {
    key: "relationships", table: "student_relationships", subjectColumn: "student_id", organization: true,
    columns: "id,organization_id,student_id,relationship_kind,relationship_label,status,can_view_profile,can_view_schedule,can_view_attendance,can_view_progress,can_view_health,can_sign_consents,can_view_financial,can_pay,created_at,revoked_at,revocation_reason",
  },
  {
    key: "absence_notices", table: "absence_notices", subjectColumn: "student_id", organization: true,
    columns: "id,organization_id,student_id,class_id,session_date,reason,note,status,created_at",
  },
  {
    key: "context_events", table: "student_context_events", subjectColumn: "student_id", organization: true,
    columns: "id,organization_id,student_id,class_id,source_type,source_id,raw_text,category,severity,confidence,status,title,summary,event_date,confirmed_at,resolved_at,created_at,updated_at",
  },
  {
    key: "health_data_logs", table: "health_data_access_logs", subjectColumn: "student_id", organization: false,
    columns: "id,student_id,accessed_at,reason,source",
  },
] as const;

export const STUDENT_EXPORT_LIMITS = {
  pageSize: 500,
  maxRowsPerDataset: 10_000,
  maxTotalRows: 50_000,
  maxBytes: 10 * 1024 * 1024,
} as const;

export const STUDENT_EXPORT_COVERAGE = {
  schema_version: 2,
  scope: "caller_visible_structured_student_records",
  universal_subject_export: false,
  visibility: "Each dataset is restricted by the caller's RLS permissions; an empty dataset does not prove absence of records.",
  included_datasets: ["student", ...STUDENT_EXPORT_DATASETS.map(({ key }) => key)],
  excluded: [
    { dataset: "session_logs", reason: "Collective class reports have no student key and may contain peers' notes/photos; no safe subject-only projection exists here." },
    { dataset: "scouting_rallies", reason: "Collective contacts are not exported; subject-specific actions are included separately." },
    { dataset: "media_and_local_copies", reason: "Photos/video binaries, drafts, downloads, device caches and backups require separate handling." },
    { dataset: "other_operations", reason: "Account/provider records, additional lifecycle/financial/security-audit history, invitations and unlinked intakes are outside this structured snapshot and require a managed request." },
    { dataset: "security_fields", reason: "Credentials, CPF ciphertext/HMAC, tag UIDs and third-party access-log IP/device metadata are excluded; protected document access needs its own authorized process." },
  ],
  consistency: "Paginated reads are not a transactional snapshot. Changed totals, duplicate IDs and invalid pagination progress abort the export. Concurrent replacements with stable totals and other edits may remain undetected.",
  limits: STUDENT_EXPORT_LIMITS,
} as const;

export class StudentExportError extends Error {
  constructor(readonly code: "EXPORT_FAILED" | "EXPORT_LIMIT_EXCEEDED") {
    super(code);
  }
}

type ExportRow = Record<string, unknown>;

export async function collectStudentExport(
  client: SupabaseClient,
  student: ExportRow,
): Promise<Record<string, ExportRow[]>> {
  const studentId = student.id;
  const organizationId = student.organization_id;
  if (typeof studentId !== "string" || typeof organizationId !== "string" || !organizationId) {
    throw new StudentExportError("EXPORT_FAILED");
  }
  const datasets: Record<string, ExportRow[]> = {};
  let totalRows = 1;
  let totalBytes = new TextEncoder().encode(JSON.stringify(student)).byteLength;

  for (const dataset of STUDENT_EXPORT_DATASETS) {
    const rows: ExportRow[] = [];
    const seenIds = new Set<string>();
    let expectedCount: number | undefined;
    do {
      let query = client.from(dataset.table)
        .select(dataset.columns, { count: "exact" })
        .eq(dataset.subjectColumn, studentId);
      if (dataset.organization) query = query.eq("organization_id", organizationId);
      const { data, error, count } = await query.order("id", { ascending: true })
        .range(rows.length, rows.length + STUDENT_EXPORT_LIMITS.pageSize - 1);
      if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count === null || count < 0) {
        throw new StudentExportError("EXPORT_FAILED");
      }
      if (count > STUDENT_EXPORT_LIMITS.maxRowsPerDataset || totalRows + count - rows.length > STUDENT_EXPORT_LIMITS.maxTotalRows) {
        throw new StudentExportError("EXPORT_LIMIT_EXCEEDED");
      }
      if (expectedCount !== undefined && expectedCount !== count) {
        throw new StudentExportError("EXPORT_FAILED");
      }
      expectedCount = count;
      if ((!data.length && rows.length < count) || rows.length + data.length > count) {
        throw new StudentExportError("EXPORT_FAILED");
      }
      for (const value of data) {
        const row = value as ExportRow;
        if (!row || typeof row.id !== "string" || seenIds.has(row.id) ||
          row[dataset.subjectColumn] !== studentId ||
          (dataset.organization && row.organization_id !== organizationId)) {
          throw new StudentExportError("EXPORT_FAILED");
        }
        seenIds.add(row.id);
        rows.push(row);
      }
      totalRows += data.length;
      totalBytes += new TextEncoder().encode(JSON.stringify(data)).byteLength;
      if (totalBytes > STUDENT_EXPORT_LIMITS.maxBytes) {
        throw new StudentExportError("EXPORT_LIMIT_EXCEEDED");
      }
      // A server cap can shorten a page. Continue until its exact total is
      // reached; never treat length < requested page size as completion.
    } while (rows.length < expectedCount);
    datasets[dataset.key] = rows;
  }
  return datasets;
}
