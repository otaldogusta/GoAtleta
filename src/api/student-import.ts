import * as Sentry from "@sentry/react-native";

import {
    forceRefreshAccessToken,
    getValidAccessToken,
} from "../auth/session";
import { measureAsync } from "../observability/perf";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { supabaseRestGet } from "./rest";

export type ImportMode = "preview" | "apply";
export type ImportPolicy = "conservador" | "misto" | "agressivo";
export type ImportAction = "create" | "update" | "conflict" | "skip" | "error";

export type StudentImportRow = {
  externalId?: string;
  name?: string;
  ra?: string;
  birthDate?: string;
  rg?: string;
  classId?: string;
  className?: string;
  unit?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianCpf?: string;
  phone?: string;
  loginEmail?: string;
  sourceRowNumber?: number;
};

export type StudentImportSummary = {
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

export type StudentImportPlannedRow = {
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

export type StudentImportFunctionResult = {
  status: "preview" | "applied" | "failed" | "partial";
  mode: ImportMode;
  runId: string;
  sourceSha256: string;
  summary: StudentImportSummary;
  rows: StudentImportPlannedRow[];
  idempotent: boolean;
};

type StudentImportRunRow = {
  id: string;
  organization_id: string;
  created_by: string;
  source_filename: string | null;
  source_sha256: string;
  mode: ImportMode;
  policy: ImportPolicy;
  status: "preview" | "applied" | "failed" | "partial";
  summary: StudentImportSummary | null;
  created_at: string;
  applied_at: string | null;
};

type StudentImportLogRow = {
  id: string;
  run_id: string;
  row_number: number;
  action: ImportAction;
  matched_by: string | null;
  confidence: "high" | "medium" | "low";
  student_id: string | null;
  class_id: string | null;
  incoming: Record<string, unknown>;
  patch: Record<string, unknown> | null;
  conflicts: Record<string, unknown> | null;
  flags: string[] | null;
  error_message: string | null;
  created_at: string;
};

export type StudentImportRun = {
  id: string;
  organizationId: string;
  createdBy: string;
  sourceFilename: string | null;
  sourceSha256: string;
  mode: ImportMode;
  policy: ImportPolicy;
  status: "preview" | "applied" | "failed" | "partial";
  summary: StudentImportSummary | null;
  createdAt: string;
  appliedAt: string | null;
};

export type StudentImportLog = {
  id: string;
  runId: string;
  rowNumber: number;
  action: ImportAction;
  matchedBy: string | null;
  confidence: "high" | "medium" | "low";
  studentId: string | null;
  classId: string | null;
  incoming: Record<string, unknown>;
  patch: Record<string, unknown> | null;
  conflicts: Record<string, unknown> | null;
  flags: string[];
  errorMessage: string | null;
  createdAt: string;
};

export type StudentsImportRequestPayload = {
  organizationId: string;
  mode: ImportMode;
  policy: ImportPolicy;
  sourceFilename?: string;
  rows: StudentImportRow[];
};

const waitForAccessToken = async (): Promise<string> => {
  let token = await getValidAccessToken();
  if (token) return token;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    token = await getValidAccessToken();
    if (token) return token;
  }

  return "";
};

const looksLikeJwt = (value: string) => {
  const token = String(value ?? "").trim();
  if (!token) return false;
  return token.split(".").length === 3;
};

const resolveStudentsImportToken = async (
  preferredAccessToken?: string | null
): Promise<string> => {
  const current = await waitForAccessToken();
  if (looksLikeJwt(current)) return current;

  const preferred = String(preferredAccessToken ?? "").trim();
  if (looksLikeJwt(preferred)) return preferred;

  const refreshed = String((await forceRefreshAccessToken()) ?? "").trim();
  if (looksLikeJwt(refreshed)) return refreshed;

  return "";
};

const mapRun = (row: StudentImportRunRow): StudentImportRun => ({
  id: row.id,
  organizationId: row.organization_id,
  createdBy: row.created_by,
  sourceFilename: row.source_filename ?? null,
  sourceSha256: row.source_sha256,
  mode: row.mode,
  policy: row.policy,
  status: row.status,
  summary: row.summary ?? null,
  createdAt: row.created_at,
  appliedAt: row.applied_at ?? null,
});

const mapLog = (row: StudentImportLogRow): StudentImportLog => ({
  id: row.id,
  runId: row.run_id,
  rowNumber: Number(row.row_number ?? 0),
  action: row.action,
  matchedBy: row.matched_by ?? null,
  confidence: row.confidence,
  studentId: row.student_id ?? null,
  classId: row.class_id ?? null,
  incoming: row.incoming ?? {},
  patch: row.patch ?? null,
  conflicts: row.conflicts ?? null,
  flags: Array.isArray(row.flags) ? row.flags : [],
  errorMessage: row.error_message ?? null,
  createdAt: row.created_at,
});

const callStudentsImport = async (
  payload: StudentsImportRequestPayload,
  preferredAccessToken?: string | null
): Promise<StudentImportFunctionResult> => {
  const accessToken = await resolveStudentsImportToken(preferredAccessToken);
  if (!accessToken) throw new Error("Sessao invalida. Faca login novamente.");

  const requestWithToken = (accessToken: string) =>
    fetch(`${SUPABASE_URL}/functions/v1/students-import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });

  let response = await requestWithToken(accessToken);
  if (response.status === 401) {
    const refreshedToken = await forceRefreshAccessToken();
    if (refreshedToken) {
      response = await requestWithToken(refreshedToken);
    }
  }

  const raw = await response.text();
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  if (!response.ok) {
    const reason =
      (typeof parsed.reason === "string" && parsed.reason.trim())
        ? parsed.reason.trim()
        : "";
    const message =
      (typeof parsed.error === "string" && parsed.error) ||
      (typeof parsed.message === "string" && parsed.message) ||
      raw ||
      "Falha ao executar importacao.";
    if (reason) {
      throw new Error(`${message} (${reason})`);
    }
    throw new Error(message);
  }

  return {
    status: String(parsed.status ?? "failed") as StudentImportFunctionResult["status"],
    mode: String(parsed.mode ?? payload.mode) as ImportMode,
    runId: String(parsed.runId ?? ""),
    sourceSha256: String(parsed.sourceSha256 ?? ""),
    summary: (parsed.summary as StudentImportSummary) ?? {
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
    },
    rows: (Array.isArray(parsed.rows) ? parsed.rows : []) as StudentImportPlannedRow[],
    idempotent: Boolean(parsed.idempotent),
  };
};

export const previewStudentsImport = async (payload: Omit<StudentsImportRequestPayload, "mode">) =>
  measureAsync("screen.studentsImport.load.preview", async () => {
    Sentry.addBreadcrumb({
      category: "students-import",
      message: "preview.request",
      level: "info",
      data: {
        organizationId: payload.organizationId,
        policy: payload.policy,
        rows: payload.rows.length,
      },
    });
    return callStudentsImport({ ...payload, mode: "preview" });
  });

export const applyStudentsImport = async (payload: Omit<StudentsImportRequestPayload, "mode">) =>
  measureAsync("screen.studentsImport.load.apply", async () => {
    Sentry.addBreadcrumb({
      category: "students-import",
      message: "apply.request",
      level: "info",
      data: {
        organizationId: payload.organizationId,
        policy: payload.policy,
        rows: payload.rows.length,
      },
    });
    return callStudentsImport({ ...payload, mode: "apply" });
  });

export const previewStudentsImportWithToken = async (
  payload: Omit<StudentsImportRequestPayload, "mode">,
  accessToken?: string | null
) =>
  measureAsync("screen.studentsImport.load.preview", async () => {
    Sentry.addBreadcrumb({
      category: "students-import",
      message: "preview.request",
      level: "info",
      data: {
        organizationId: payload.organizationId,
        policy: payload.policy,
        rows: payload.rows.length,
      },
    });
    return callStudentsImport({ ...payload, mode: "preview" }, accessToken);
  });

export const applyStudentsImportWithToken = async (
  payload: Omit<StudentsImportRequestPayload, "mode">,
  accessToken?: string | null
) =>
  measureAsync("screen.studentsImport.load.apply", async () => {
    Sentry.addBreadcrumb({
      category: "students-import",
      message: "apply.request",
      level: "info",
      data: {
        organizationId: payload.organizationId,
        policy: payload.policy,
        rows: payload.rows.length,
      },
    });
    return callStudentsImport({ ...payload, mode: "apply" }, accessToken);
  });

export async function listStudentImportRuns(
  organizationId: string,
  limit = 20
): Promise<StudentImportRun[]> {
  const rows = await supabaseRestGet<StudentImportRunRow[]>(
    "/student_import_runs?organization_id=eq." +
      encodeURIComponent(organizationId) +
      "&select=*&order=created_at.desc&limit=" +
      String(Math.max(1, Math.min(limit, 200)))
  );
  return (rows ?? []).map(mapRun);
}

export async function getStudentImportRunLogs(
  runId: string,
  limit = 200,
  offset = 0
): Promise<StudentImportLog[]> {
  const rows = await supabaseRestGet<StudentImportLogRow[]>(
    "/student_import_logs?run_id=eq." +
      encodeURIComponent(runId) +
      "&select=*&order=row_number.asc&limit=" +
      String(Math.max(1, Math.min(limit, 1000))) +
      "&offset=" +
      String(Math.max(0, offset))
  );
  return (rows ?? []).map(mapLog);
}
