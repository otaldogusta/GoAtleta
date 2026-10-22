import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateObjectPayload, validateStringField } from "../_shared/input-validation.ts";
import {
  collectStudentExport,
  STUDENT_EXPORT_COLUMNS,
  STUDENT_EXPORT_COVERAGE,
  STUDENT_EXPORT_LIMITS,
  StudentExportError,
} from "../_shared/lgpd-export-data.ts";

const makeJsonHeaders = (req: Request) => ({
  ...buildCorsHeaders(req),
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
});

const createError = (req: Request, status: number, code: string, error: string) =>
  new Response(JSON.stringify({ code, error }), { status, headers: makeJsonHeaders(req) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  if (req.method !== "POST") return createError(req, 405, "INVALID_REQUEST", "Method not allowed");

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1]?.trim();
  if (!token) return createError(req, 401, "UNAUTHORIZED", "Unauthorized");

  let studentId: string;
  try {
    const payload = validateObjectPayload(await req.json(), { maxBytes: 1_024 });
    if (!payload.ok || !payload.data || typeof payload.data.studentId !== "string") {
      return createError(req, 400, "INVALID_REQUEST", "Invalid request");
    }
    const field = validateStringField(payload.data.studentId, {
      minLength: 1, maxLength: 128, pattern: /^[a-zA-Z0-9_-]+$/,
    });
    if (!field.ok) return createError(req, 400, "INVALID_REQUEST", "Invalid studentId");
    studentId = field.data;
  } catch {
    return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  // This key only writes a server-owned receipt after all reads/serialization.
  // It must never read subject data or bypass RLS.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return createError(req, 503, "EXPORT_UNAVAILABLE", "Export temporarily unavailable");
  }

  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    // Decode-only JWT checks do not authenticate a caller. Ask Supabase Auth,
    // and use the same token for every RLS-protected data query.
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user?.id) return createError(req, 401, "UNAUTHORIZED", "Unauthorized");

    const { data: student, error: studentError } = await supabase.from("students")
      .select(STUDENT_EXPORT_COLUMNS).eq("id", studentId).maybeSingle();
    if (studentError) throw new StudentExportError("EXPORT_FAILED");
    if (!student) return createError(req, 404, "NOT_FOUND", "Student not found or access denied");
    if (student.id !== studentId) throw new StudentExportError("EXPORT_FAILED");

    const datasets = await collectStudentExport(supabase, student);
    const generatedAt = new Date().toISOString();
    const serialized = JSON.stringify({
      generated_at: generatedAt,
      requested_by: authData.user.id,
      coverage: STUDENT_EXPORT_COVERAGE,
      student,
      ...datasets,
    });
    if (new TextEncoder().encode(serialized).byteLength > STUDENT_EXPORT_LIMITS.maxBytes) {
      throw new StudentExportError("EXPORT_LIMIT_EXCEEDED");
    }
    const response = new Response(serialized, {
      status: 200,
      headers: {
        ...makeJsonHeaders(req),
        "Content-Disposition": `attachment; filename="goatleta_export_${studentId}.json"`,
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: receiptError } = await adminClient.from("data_subject_requests").insert({
      user_id: authData.user.id,
      student_id: studentId,
      status: "completed",
      request_type: "export",
      reason: "Structured caller-visible snapshot; does not close a universal subject-access request",
      processed_at: generatedAt,
      metadata: { export_coverage: STUDENT_EXPORT_COVERAGE },
    });
    if (receiptError) throw new StudentExportError("EXPORT_FAILED");
    return response;
  } catch (error) {
    if (error instanceof StudentExportError && error.code === "EXPORT_LIMIT_EXCEEDED") {
      return createError(req, 413, error.code, "Export exceeds the self-service limit; request a managed export");
    }
    // Never return/log upstream messages, query contents, JWTs or partial data.
    return createError(req, 500, "EXPORT_FAILED", "Unable to complete export; no file was generated");
  }
});
