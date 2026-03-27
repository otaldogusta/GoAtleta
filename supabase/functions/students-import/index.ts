import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    validateArrayLength,
    validateStringField,
} from "../_shared/input-validation.ts";

import {
    buildMatcher,
    findExistingStudent,
    registerStudentInMatcher,
} from "./engine/match.ts";
import { computeMergePatch } from "./engine/merge.ts";
import { hashSourceRows, normalizeImportRows } from "./engine/normalize.ts";
import type {
    ExistingClassRow,
    ExistingStudentRow,
    ImportAction,
    ImportMode,
    ImportPolicy,
    ImportRunStatus,
    NormalizedImportRow,
    StudentImportRow,
} from "./engine/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

const RATE_LIMIT_STORE =
  (globalThis as unknown as {
    __studentsImportRateLimitStore?: Map<string, { count: number; resetAt: number }>;
  }).__studentsImportRateLimitStore ??
  new Map<string, { count: number; resetAt: number }>();

(globalThis as unknown as { __studentsImportRateLimitStore?: typeof RATE_LIMIT_STORE }).__studentsImportRateLimitStore =
  RATE_LIMIT_STORE;

const checkRateLimit = (
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult => {
  const now = Date.now();
  const previous = RATE_LIMIT_STORE.get(key);
  if (!previous || now >= previous.resetAt) {
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }
  if (previous.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((previous.resetAt - now) / 1000)),
    };
  }
  previous.count += 1;
  RATE_LIMIT_STORE.set(key, previous);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - previous.count),
    retryAfterSec: Math.max(1, Math.ceil((previous.resetAt - now) / 1000)),
  };
};

type StudentsImportRequest = {
  organizationId?: string;
  mode?: ImportMode;
  policy?: ImportPolicy;
  sourceFilename?: string;
  rows?: StudentImportRow[];
  runId?: string;
  resolutions?: Record<string, string>;
};
const MAX_IMPORT_ROWS = 500;

type ConflictResolution = "KEEP_EXISTING" | "OVERWRITE" | "SKIP";

type ResolutionMap = Record<string, ConflictResolution>;

type RunSummary = {
  totalRows: number;
  create: number;
  update: number;
  conflict: number;
  skip: number;
  error: number;
  confidenceHigh: number;
  confidenceMedium: number;
  confidenceLow: number;
  flags: Record<string, number>;
};

type PlannedRow = {
  rowNumber: number;
  action: ImportAction;
  matchedBy: string | null;
  confidence: "high" | "medium" | "low";
  studentId: string | null;
  classId: string | null;
  className: string | null;
  flags: string[];
  conflicts: Record<string, unknown> | null;
  errorMessage: string | null;
};

type ClassLookup = {
  byId: Map<string, ExistingClassRow>;
  byName: Map<string, ExistingClassRow[]>;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const asJson = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const createServiceClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
};

const createRequestAuthClient = (request: Request) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!url || !anonKey || !authHeader) return null;

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
};

const fetchUserFromAuthApi = async (token: string) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const apiKey = anonKey || serviceRoleKey;
  if (!url || !apiKey) {
    return { user: null, reason: "missing_auth_api_configuration" };
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const raw = await res.text();
    if (!res.ok) {
      return { user: null, reason: raw || `auth_api_status_${res.status}` };
    }

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      parsed = null;
    }

    const userId = typeof parsed?.id === "string" ? parsed.id.trim() : "";
    if (!userId) {
      return { user: null, reason: "auth_api_missing_user_id" };
    }

    return { user: { id: userId }, reason: null };
  } catch (error) {
    return {
      user: null,
      reason: error instanceof Error ? error.message : "auth_api_request_failed",
    };
  }
};

const requireUser = async (
  request: Request,
  supabase: ReturnType<typeof createServiceClient>
) => {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { user: null, reason: "missing_authorization_header" };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return { user: null, reason: "empty_bearer_token" };

  const authApi = await fetchUserFromAuthApi(token);
  if (authApi.user) {
    return authApi;
  }
  const authApiReason = authApi.reason ? `auth_api:${authApi.reason}` : "auth_api:unknown";

  const requestAuthClient = createRequestAuthClient(request);
  if (requestAuthClient) {
    const { data, error } = await requestAuthClient.auth.getUser(token);
    if (!error && data.user) {
      return { user: data.user, reason: null };
    }
    const requestReason = error?.message
      ? `request_auth_getUser:${error.message}`
      : "request_auth_getUser:missing_user";
    if (!supabase) {
      return { user: null, reason: `${authApiReason} | ${requestReason} | missing_service_role_configuration` };
    }
  } else if (!supabase) {
    return { user: null, reason: `${authApiReason} | missing_request_auth_client | missing_service_role_configuration` };
  }

  if (!supabase) return { user: null, reason: `${authApiReason} | missing_service_role_configuration` };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      user: null,
      reason: `${authApiReason} | service_auth_getUser:${error?.message || "invalid_jwt"}`,
    };
  }
  return { user: data.user, reason: null };
};

const parsePayload = async (request: Request): Promise<StudentsImportRequest | null> => {
  try {
    return (await request.json()) as StudentsImportRequest;
  } catch {
    return null;
  }
};

const validateMode = (value: unknown): ImportMode => {
  if (value === "preview" || value === "apply") return value;
  return "preview";
};

const validatePolicy = (value: unknown): ImportPolicy => {
  if (value === "conservador" || value === "misto" || value === "agressivo") return value;
  return "misto";
};

const resolveClass = (
  row: NormalizedImportRow,
  classLookup: ClassLookup
): { classId: string | null; classFound: boolean; className: string | null } => {
  if (row.classId) {
    const found = classLookup.byId.get(row.classId) ?? null;
    return {
      classId: found?.id ?? null,
      classFound: Boolean(found),
      className: found?.name ?? row.className ?? null,
    };
  }

  const classNameNormalized = normalizeText(row.className ?? "");
  if (!classNameNormalized) {
    return { classId: null, classFound: false, className: null };
  }

  const candidates = classLookup.byName.get(classNameNormalized) ?? [];
  if (!candidates.length) {
    return { classId: null, classFound: false, className: row.className ?? null };
  }
  if (candidates.length === 1) {
    return { classId: candidates[0].id, classFound: true, className: candidates[0].name };
  }

  const unitNorm = normalizeText(row.unit ?? "");
  if (unitNorm) {
    const filtered = candidates.filter((item) => normalizeText(item.unit ?? "") === unitNorm);
    if (filtered.length === 1) {
      return { classId: filtered[0].id, classFound: true, className: filtered[0].name };
    }
  }

  return { classId: null, classFound: false, className: row.className ?? null };
};

const buildClassLookup = (classes: ExistingClassRow[]): ClassLookup => {
  const byId = new Map<string, ExistingClassRow>();
  const byName = new Map<string, ExistingClassRow[]>();
  for (const item of classes) {
    byId.set(item.id, item);
    const normalized = normalizeText(item.name);
    const list = byName.get(normalized) ?? [];
    list.push(item);
    byName.set(normalized, list);
  }
  return { byId, byName };
};

const emptySummary = (): RunSummary => ({
  totalRows: 0,
  create: 0,
  update: 0,
  conflict: 0,
  skip: 0,
  error: 0,
  confidenceHigh: 0,
  confidenceMedium: 0,
  confidenceLow: 0,
  flags: {},
});

const normalizeResolutions = (value: unknown): ResolutionMap => {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: ResolutionMap = {};
  for (const [key, raw] of entries) {
    const resolution = String(raw ?? "").toUpperCase();
    if (resolution === "KEEP_EXISTING" || resolution === "OVERWRITE" || resolution === "SKIP") {
      normalized[String(key)] = resolution;
    }
  }
  return normalized;
};

const getResolutionForRow = (
  resolutions: ResolutionMap,
  rowNumber: number,
  logId: string
): ConflictResolution | null => resolutions[String(logId)] ?? resolutions[String(rowNumber)] ?? null;

type ImportLogRow = {
  id: string;
  row_number: number;
  action: ImportAction;
  matched_by: string | null;
  confidence: "high" | "medium" | "low";
  student_id: string | null;
  class_id: string | null;
  patch: Record<string, unknown> | null;
  conflicts: Record<string, unknown> | null;
  flags: string[] | null;
  error_message: string | null;
};

const chunk = <T>(list: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
};

const buildStudentInsertPayload = (
  patch: Record<string, unknown>,
  organizationId: string
) => ({
  ...patch,
  id:
    typeof patch.id === "string" && patch.id.trim().length > 0
      ? patch.id.trim()
      : crypto.randomUUID(),
  organization_id: organizationId,
});

const nonEmptyScore = (value: unknown) => (String(value ?? "").trim().length > 0 ? 1 : 0);

const rowCompletenessScore = (row: NormalizedImportRow): number => {
  return (
    nonEmptyScore(row.name) * 2 +
    nonEmptyScore(row.birthDate) * 2 +
    nonEmptyScore(row.classId) +
    nonEmptyScore(row.className) +
    nonEmptyScore(row.unit) +
    nonEmptyScore(row.ra) +
    nonEmptyScore(row.externalId) +
    nonEmptyScore(row.rgNormalized) +
    nonEmptyScore(row.phone) +
    nonEmptyScore(row.loginEmail) +
    nonEmptyScore(row.guardianName) +
    nonEmptyScore(row.guardianPhone) +
    nonEmptyScore(row.guardianCpfHmac)
  );
};

const choosePrimaryRowsForDuplicateIdentity = (
  rows: NormalizedImportRow[]
): Map<number, number> => {
  const duplicateGroups = new Map<string, NormalizedImportRow[]>();
  for (const row of rows) {
    if (!row.identityKey) continue;
    const list = duplicateGroups.get(row.identityKey) ?? [];
    list.push(row);
    duplicateGroups.set(row.identityKey, list);
  }

  const supersededByRowNumber = new Map<number, number>();

  duplicateGroups.forEach((groupRows) => {
    if (groupRows.length <= 1) return;

    const winner = [...groupRows].sort((a, b) => {
      const scoreDiff = rowCompletenessScore(b) - rowCompletenessScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      // Prefer latest response when completeness ties.
      return b.sourceRowNumber - a.sourceRowNumber;
    })[0];

    groupRows.forEach((row) => {
      if (row.sourceRowNumber === winner.sourceRowNumber) return;
      supersededByRowNumber.set(row.sourceRowNumber, winner.sourceRowNumber);
    });
  });

  return supersededByRowNumber;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return asJson(405, { error: "Method not allowed" });
  }

  const supabase = createServiceClient();
  if (!supabase) return asJson(500, { error: "Missing service role configuration." });
  const auth = await requireUser(request, supabase);
  if (!auth.user) {
    return asJson(401, { error: "Unauthorized", reason: auth.reason });
  }
  const user = auth.user;

  const payload = await parsePayload(request);
  if (!payload) return asJson(400, { error: "Invalid JSON body" });

  const organizationValidation = validateStringField(payload.organizationId, {
    minLength: 1,
    maxLength: 128,
  });
  if (!organizationValidation.ok) {
    return asJson(400, { error: `Invalid organizationId: ${organizationValidation.error}` });
  }

  const organizationId = organizationValidation.data;
  const mode = validateMode(payload.mode);
  const policy = validatePolicy(payload.policy);
  const runIdValidation = validateStringField(payload.runId, {
    minLength: 1,
    maxLength: 128,
    trim: true,
  });
  const applyRunId = mode === "apply" && runIdValidation.ok ? runIdValidation.data : "";
  const requiresRows = mode === "preview" || (mode === "apply" && !applyRunId);

  let rowsInput: Record<string, unknown>[] = [];
  if (requiresRows) {
    const rowsValidation = validateArrayLength<Record<string, unknown>>(payload.rows, {
      minLength: 1,
      maxLength: MAX_IMPORT_ROWS,
    });
    if (!rowsValidation.ok) {
      return asJson(400, { error: `Invalid rows: ${rowsValidation.error}` });
    }
    rowsInput = rowsValidation.data;
  }

  const sourceFilenameValidation = validateStringField(payload.sourceFilename, {
    maxLength: 255,
    trim: true,
  });
  const sourceFilename = sourceFilenameValidation.ok && sourceFilenameValidation.data
    ? sourceFilenameValidation.data
    : null;

  const { data: memberRow, error: memberError } = await supabase
    .from("organization_members")
    .select("role_level")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) return asJson(500, { error: memberError.message });
  const memberRoleLevel = Number(memberRow?.role_level ?? 0);
  if (!memberRow || !Number.isFinite(memberRoleLevel) || memberRoleLevel < 50) {
    return asJson(403, { error: "Forbidden" });
  }

  const maxRequestsPerMinute = Math.max(
    1,
    Number.parseInt(String(Deno.env.get("STUDENTS_IMPORT_RATE_LIMIT_PER_MIN") ?? "8"), 10) || 8
  );
  const limiter = checkRateLimit(
    `students-import:${organizationId}:${user.id}`,
    maxRequestsPerMinute,
    60_000
  );
  if (!limiter.allowed) {
    return asJson(429, {
      error: "Rate limit exceeded",
      retryAfterSec: limiter.retryAfterSec,
      maxRequestsPerMinute,
    });
  }

  if (mode === "apply" && applyRunId) {
    const resolutions = normalizeResolutions(payload.resolutions);

    const { data: runRow, error: runError } = await supabase
      .from("student_import_runs")
      .select("id, organization_id, source_sha256, policy, status, mode, summary")
      .eq("id", applyRunId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (runError) return asJson(500, { error: runError.message });
    if (!runRow) return asJson(404, { error: "Import run not found." });

    if (runRow.mode === "apply" && (runRow.status === "applied" || runRow.status === "partial")) {
      return asJson(200, {
        status: runRow.status,
        mode: "apply",
        runId: runRow.id,
        sourceSha256: runRow.source_sha256,
        summary: runRow.summary ?? emptySummary(),
        idempotent: true,
      });
    }

    const { data: existingAppliedRun, error: existingAppliedRunError } = await supabase
      .from("student_import_runs")
      .select("id, status, summary")
      .eq("organization_id", organizationId)
      .eq("source_sha256", runRow.source_sha256)
      .eq("policy", runRow.policy)
      .eq("mode", "apply")
      .in("status", ["applied", "partial"])
      .neq("id", runRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingAppliedRunError) return asJson(500, { error: existingAppliedRunError.message });
    if (existingAppliedRun) {
      return asJson(200, {
        status: existingAppliedRun.status,
        mode: "apply",
        runId: existingAppliedRun.id,
        sourceSha256: runRow.source_sha256,
        summary: existingAppliedRun.summary ?? emptySummary(),
        idempotent: true,
      });
    }

    const { data: logs, error: logsError } = await supabase
      .from("student_import_logs")
      .select("id, row_number, action, matched_by, confidence, student_id, class_id, patch, conflicts, flags, error_message")
      .eq("run_id", runRow.id)
      .order("row_number", { ascending: true });

    if (logsError) return asJson(500, { error: logsError.message });
    const plannedLogs = (logs ?? []) as ImportLogRow[];
    if (!plannedLogs.length) {
      return asJson(400, { error: "Import run has no planned rows." });
    }

    const unresolvedConflicts = plannedLogs
      .filter((log) => log.action === "conflict")
      .filter((log) => !getResolutionForRow(resolutions, Number(log.row_number), String(log.id)));

    if (unresolvedConflicts.length > 0) {
      return asJson(409, {
        error: "Unresolved conflicts.",
        runId: runRow.id,
        unresolved: unresolvedConflicts.slice(0, 50).map((log) => ({
          id: log.id,
          rowNumber: log.row_number,
          flags: log.flags ?? [],
          conflicts: log.conflicts,
        })),
      });
    }

    const summary = emptySummary();
    summary.totalRows = plannedLogs.length;
    const plannedRows: PlannedRow[] = [];

    for (const log of plannedLogs) {
      const confidence = (log.confidence ?? "low") as "high" | "medium" | "low";
      const flags = Array.isArray(log.flags) ? log.flags : [];
      const rowNumber = Number(log.row_number ?? 0);
      const resolution = log.action === "conflict"
        ? getResolutionForRow(resolutions, rowNumber, String(log.id))
        : null;

      let action: ImportAction = log.action;
      let errorMessage: string | null = log.error_message ?? null;
      let studentId: string | null = log.student_id ?? null;
      const patch = (log.patch ?? null) as Record<string, unknown> | null;

      try {
        if (log.action === "conflict") {
          if (resolution === "KEEP_EXISTING" || resolution === "SKIP") {
            action = "skip";
          } else if (resolution === "OVERWRITE") {
            if (!studentId || !patch) {
              action = "skip";
              errorMessage = "Conflict overwrite ignored: missing student_id or patch.";
            } else {
              const { data: updated, error: updateError } = await supabase
                .from("students")
                .update(patch)
                .eq("id", studentId)
                .eq("organization_id", organizationId)
                .select("id")
                .single();
              if (updateError || !updated) {
                action = "error";
                errorMessage = updateError?.message ?? "Failed to overwrite student conflict.";
              } else {
                action = "update";
                studentId = String(updated.id);
              }
            }
          }
        } else if (log.action === "create") {
          if (!patch) {
            action = "error";
            errorMessage = "Missing patch for create action.";
          } else {
            const { data: created, error: createError } = await supabase
              .from("students")
              .insert(buildStudentInsertPayload(patch, organizationId))
              .select("id")
              .single();
            if (createError || !created) {
              action = "error";
              errorMessage = createError?.message ?? "Failed to create student.";
            } else {
              studentId = String(created.id);
            }
          }
        } else if (log.action === "update") {
          if (!studentId || !patch) {
            action = "error";
            errorMessage = "Missing student_id or patch for update action.";
          } else {
            const { data: updated, error: updateError } = await supabase
              .from("students")
              .update(patch)
              .eq("id", studentId)
              .eq("organization_id", organizationId)
              .select("id")
              .single();
            if (updateError || !updated) {
              action = "error";
              errorMessage = updateError?.message ?? "Failed to update student.";
            }
          }
        }
      } catch (applyError) {
        action = "error";
        errorMessage = applyError instanceof Error ? applyError.message : "Unexpected apply error.";
      }

      if (action === "create") summary.create += 1;
      if (action === "update") summary.update += 1;
      if (action === "conflict") summary.conflict += 1;
      if (action === "skip") summary.skip += 1;
      if (action === "error") summary.error += 1;
      if (confidence === "high") summary.confidenceHigh += 1;
      if (confidence === "medium") summary.confidenceMedium += 1;
      if (confidence === "low") summary.confidenceLow += 1;
      for (const flag of flags) {
        summary.flags[flag] = (summary.flags[flag] ?? 0) + 1;
      }

      plannedRows.push({
        rowNumber,
        action,
        matchedBy: log.matched_by ?? null,
        confidence,
        studentId,
        classId: log.class_id ?? null,
        className: null,
        flags,
        conflicts: (log.conflicts ?? null) as Record<string, unknown> | null,
        errorMessage,
      });
    }

    let finalStatus: ImportRunStatus = "applied";
    if (summary.error > 0 && summary.create + summary.update === 0) {
      finalStatus = "failed";
    } else if (summary.error > 0 || summary.conflict > 0) {
      finalStatus = "partial";
    }

    const { error: runUpdateError } = await supabase
      .from("student_import_runs")
      .update({
        mode: "apply",
        status: finalStatus,
        summary,
        applied_at: new Date().toISOString(),
      })
      .eq("id", runRow.id)
      .eq("organization_id", organizationId);

    if (runUpdateError) return asJson(500, { error: runUpdateError.message });

    return asJson(200, {
      status: finalStatus,
      mode: "apply",
      runId: runRow.id,
      sourceSha256: runRow.source_sha256,
      summary,
      rows: plannedRows,
      idempotent: false,
    });
  }

  const secret = String(Deno.env.get("STUDENT_IMPORT_HMAC_SECRET") ?? "").trim();
  if (!secret) {
    return asJson(500, {
      error: "Missing STUDENT_IMPORT_HMAC_SECRET configuration.",
    });
  }

  const normalizedRows = await normalizeImportRows(rowsInput, secret);
  const sourceSha256 = await hashSourceRows(normalizedRows);

  if (mode === "apply") {
    const { data: existingRun, error: existingRunError } = await supabase
      .from("student_import_runs")
      .select("id, status, summary")
      .eq("organization_id", organizationId)
      .eq("source_sha256", sourceSha256)
      .eq("policy", policy)
      .eq("mode", "apply")
      .in("status", ["applied", "partial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRunError) return asJson(500, { error: existingRunError.message });
    if (existingRun) {
      return asJson(200, {
        status: existingRun.status,
        mode,
        runId: existingRun.id,
        sourceSha256,
        summary: existingRun.summary ?? emptySummary(),
        idempotent: true,
      });
    }
  }

  const { data: runRow, error: runInsertError } = await supabase
    .from("student_import_runs")
    .insert({
      organization_id: organizationId,
      created_by: user.id,
      source_filename: sourceFilename,
      source_sha256: sourceSha256,
      mode,
      policy,
      status: "preview",
      summary: null,
    })
    .select("id")
    .single();

  if (runInsertError || !runRow?.id) {
    return asJson(500, { error: runInsertError?.message ?? "Failed to create import run." });
  }

  const runId = String(runRow.id);
  const summary = emptySummary();
  summary.totalRows = normalizedRows.length;

  const { data: classesRows, error: classesError } = await supabase
    .from("classes")
    .select("id, name, unit, organization_id")
    .eq("organization_id", organizationId);
  if (classesError) {
    await supabase
      .from("student_import_runs")
      .update({ status: "failed", summary, applied_at: new Date().toISOString() })
      .eq("id", runId);
    return asJson(500, { error: classesError.message });
  }

  const { data: studentsRows, error: studentsError } = await supabase
    .from("students")
    .select(
      "id, organization_id, classid, name, ra, birthdate, age, phone, login_email, guardian_name, guardian_phone, guardian_relation, external_id, rg_normalized, guardian_cpf_hmac, createdat"
    )
    .eq("organization_id", organizationId);
  if (studentsError) {
    await supabase
      .from("student_import_runs")
      .update({ status: "failed", summary, applied_at: new Date().toISOString() })
      .eq("id", runId);
    return asJson(500, { error: studentsError.message });
  }

  const classLookup = buildClassLookup((classesRows ?? []) as ExistingClassRow[]);
  const matcher = buildMatcher((studentsRows ?? []) as ExistingStudentRow[]);

  const supersededByRowNumber = choosePrimaryRowsForDuplicateIdentity(normalizedRows);
  const logsToInsert: Record<string, unknown>[] = [];
  const plannedRows: PlannedRow[] = [];

  for (const row of normalizedRows) {
    try {
      const duplicateWinnerRowNumber = supersededByRowNumber.get(row.sourceRowNumber) ?? null;
      const duplicateInput = Boolean(duplicateWinnerRowNumber);

      const match = findExistingStudent(row, matcher);
      const classResolution = resolveClass(row, classLookup);

      let merge;
      if (match.ambiguousBy) {
        merge = {
          action: "conflict" as ImportAction,
          patch: null,
          conflicts: {
            matchedBy: match.ambiguousBy,
            candidateIds: match.candidateIds,
            reason: "Mais de um cadastro corresponde aos mesmos identificadores.",
          },
          flags: ["AMBIGUOUS_MATCH"],
        };
      } else {
        merge = computeMergePatch({
          existing: match.student,
          incoming: row,
          policy,
          confidence: match.confidence,
          resolvedClassId: classResolution.classId,
          classFound: classResolution.classFound,
          duplicateInput,
          duplicateWinnerRowNumber,
        });
      }

      let action: ImportAction = merge.action;
      let studentId = match.student?.id ?? null;
      let errorMessage: string | null = null;

      if (mode === "apply") {
        if (action === "create" && merge.patch) {
          const insertPayload = buildStudentInsertPayload(merge.patch, organizationId);
          const { data: created, error: createError } = await supabase
            .from("students")
            .insert(insertPayload)
            .select(
              "id, organization_id, classid, name, ra, birthdate, age, phone, login_email, guardian_name, guardian_phone, guardian_relation, external_id, rg_normalized, guardian_cpf_hmac, createdat"
            )
            .single();
          if (createError || !created) {
            action = "error";
            errorMessage = createError?.message ?? "Failed to create student.";
          } else {
            studentId = created.id;
            registerStudentInMatcher(matcher, created as ExistingStudentRow);
          }
        } else if (action === "update" && merge.patch && match.student?.id) {
          const { data: updated, error: updateError } = await supabase
            .from("students")
            .update(merge.patch)
            .eq("id", match.student.id)
            .eq("organization_id", organizationId)
            .select(
              "id, organization_id, classid, name, ra, birthdate, age, phone, login_email, guardian_name, guardian_phone, guardian_relation, external_id, rg_normalized, guardian_cpf_hmac, createdat"
            )
            .single();
          if (updateError || !updated) {
            action = "error";
            errorMessage = updateError?.message ?? "Failed to update student.";
          } else {
            studentId = updated.id;
            registerStudentInMatcher(matcher, updated as ExistingStudentRow);
          }
        }
      }

      if (action === "create") summary.create += 1;
      if (action === "update") summary.update += 1;
      if (action === "conflict") summary.conflict += 1;
      if (action === "skip") summary.skip += 1;
      if (action === "error") summary.error += 1;
      if (match.confidence === "high") summary.confidenceHigh += 1;
      if (match.confidence === "medium") summary.confidenceMedium += 1;
      if (match.confidence === "low") summary.confidenceLow += 1;
      for (const flag of merge.flags) {
        summary.flags[flag] = (summary.flags[flag] ?? 0) + 1;
      }

      logsToInsert.push({
        run_id: runId,
        row_number: row.sourceRowNumber,
        action,
        matched_by: match.matchedBy,
        confidence: match.confidence,
        student_id: studentId,
        class_id: classResolution.classId,
        incoming: row.incomingForLog,
        patch: merge.patch,
        conflicts: merge.conflicts,
        flags: merge.flags,
        error_message: errorMessage,
      });

      plannedRows.push({
        rowNumber: row.sourceRowNumber,
        action,
        matchedBy: match.matchedBy,
        confidence: match.confidence,
        studentId,
        classId: classResolution.classId,
        className: classResolution.className,
        flags: merge.flags,
        conflicts: merge.conflicts,
        errorMessage,
      });
    } catch (rowError) {
      const errorMessage = rowError instanceof Error ? rowError.message : "Unexpected row error";
      summary.error += 1;
      logsToInsert.push({
        run_id: runId,
        row_number: row.sourceRowNumber,
        action: "error",
        matched_by: null,
        confidence: "low",
        student_id: null,
        class_id: null,
        incoming: row.incomingForLog,
        patch: null,
        conflicts: null,
        flags: ["ROW_ERROR"],
        error_message: errorMessage,
      });
      plannedRows.push({
        rowNumber: row.sourceRowNumber,
        action: "error",
        matchedBy: null,
        confidence: "low",
        studentId: null,
        classId: null,
        className: row.className,
        flags: ["ROW_ERROR"],
        conflicts: null,
        errorMessage,
      });
    }
  }

  for (const batch of chunk(logsToInsert, 200)) {
    const { error: logError } = await supabase.from("student_import_logs").insert(batch);
    if (logError) {
      await supabase
        .from("student_import_runs")
        .update({
          status: "failed",
          summary,
          applied_at: mode === "apply" ? new Date().toISOString() : null,
        })
        .eq("id", runId);
      return asJson(500, { error: logError.message, runId });
    }
  }

  let finalStatus: ImportRunStatus = "preview";
  if (mode === "apply") {
    if (summary.error > 0 && summary.create + summary.update === 0) {
      finalStatus = "failed";
    } else if (summary.error > 0 || summary.conflict > 0) {
      finalStatus = "partial";
    } else {
      finalStatus = "applied";
    }
  }

  const { error: runUpdateError } = await supabase
    .from("student_import_runs")
    .update({
      status: finalStatus,
      summary,
      applied_at: mode === "apply" ? new Date().toISOString() : null,
    })
    .eq("id", runId);

  if (runUpdateError) {
    return asJson(500, { error: runUpdateError.message, runId });
  }

  return asJson(200, {
    status: finalStatus,
    mode,
    runId,
    sourceSha256,
    summary,
    rows: plannedRows,
    idempotent: false,
  });
});
