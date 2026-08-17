import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateStringField } from "../_shared/input-validation.ts";


const makeJsonHeaders = (req: Request) => ({ ...buildCorsHeaders(req), "Content-Type": "application/json" });

const createError = (req: Request, status: number, code: string, error: string) =>
  new Response(JSON.stringify({ code, error }), { status, headers: makeJsonHeaders(req) });

const requireUser = (req: Request): { id: string; email?: string; token: string } | null => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    ) as Record<string, unknown>;
    const sub = payload["sub"];
    const exp = payload["exp"];
    if (typeof sub !== "string" || !sub) return null;
    if (typeof exp === "number" && exp < Date.now() / 1000) return null;
    return { id: sub, email: typeof payload["email"] === "string" ? payload["email"] : undefined, token };
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflight(req);
  }
  if (req.method !== "POST") {
    return createError(req, 405, "INVALID_REQUEST", "Method not allowed");
  }

  const user = requireUser(req);
  if (!user) {
    return createError(req, 401, "UNAUTHORIZED", "Unauthorized");
  }

  let payload: { studentId: string } = { studentId: "" };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
  }

  const studentId = payload.studentId?.trim();
  if (!studentId) {
    return createError(req, 400, "INVALID_REQUEST", "Missing studentId");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    return createError(req, 500, "SERVER_ERROR", "Missing Supabase URL or Anon Key config");
  }

  // Use the authenticated user's token so RLS enforces access
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    },
  });

  // Verify access without requesting the protected health columns directly.
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select(
      "id, name, organization_id, photo_url, ra, ra_start_year, external_id, cpf_masked, cpf_hmac, rg, rg_normalized, is_experimental, membership_status, financial_status, inactivated_at, inactivated_by, inactivation_reason, source_pre_registration_id, classid, age, phone, login_email, guardian_name, guardian_phone, guardian_relation, position_primary, position_secondary, athlete_objective, learning_style, birthdate, createdat"
    )
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    return createError(req, 404, "NOT_FOUND", "Student not found or access denied");
  }

  // Health data must pass through the audited RPC after the boundary migration.
  // The legacy read keeps this Edge Function compatible during the app-first rollout.
  let healthProfile: Record<string, unknown> | null = null;
  const { data: healthRows, error: healthError } = await supabase.rpc(
    "get_student_health_profiles",
    {
      p_student_ids: [studentId],
      p_reason: "Exportação LGPD solicitada pelo titular",
      p_source: "lgpd-export",
    },
  );

  if (!healthError) {
    healthProfile = Array.isArray(healthRows) ? (healthRows[0] ?? null) : null;
  } else if (healthError.code === "PGRST202" || healthError.code === "42883") {
    const { data: legacyHealth } = await supabase
      .from("students")
      .select("health_issue, health_issue_notes, medication_use, medication_notes, health_observations")
      .eq("id", studentId)
      .maybeSingle();
    healthProfile = legacyHealth ?? null;
  } else {
    return createError(req, 500, "SERVER_ERROR", "Unable to audit health data export");
  }

  // Fetch all related personal data
  const [
    { data: consents },
    { data: attendance },
    { data: sessions },
    { data: scouting },
    { data: healthLogs }
  ] = await Promise.all([
    supabase.from("consents").select("*").eq("student_id", studentId),
    supabase.from("attendance_checkins").select("*").eq("student_id", studentId),
    supabase.from("session_logs").select("*").eq("student_id", studentId),
    supabase.from("student_scouting_logs").select("*").eq("student_id", studentId),
    supabase.from("health_data_access_logs").select("*").eq("student_id", studentId)
  ]);

  // We log this export request
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceRoleKey) {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    await adminClient.from("data_subject_requests").insert({
      user_id: user.id,
      student_id: studentId,
      status: "completed",
      request_type: "export",
      reason: "Self-service JSON export requested by user",
      processed_at: new Date().toISOString()
    });
  }

  const exportPayload = {
    generated_at: new Date().toISOString(),
    requested_by: user.id,
    student,
    health_profile: healthProfile,
    consents: consents ?? [],
    attendance: attendance ?? [],
    sessions: sessions ?? [],
    scouting: scouting ?? [],
    health_data_logs: healthLogs ?? [],
  };

  return new Response(JSON.stringify(exportPayload), {
    status: 200,
    headers: {
      ...makeJsonHeaders(req),
      // Forcing download as file
      "Content-Disposition": `attachment; filename="goatleta_export_${studentId}.json"`,
    },
  });
});
