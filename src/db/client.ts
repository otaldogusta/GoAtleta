// ---------------------------------------------------------------------------
// Supabase REST client + cache + org scope helpers
// Shared infrastructure used by all domain modules in src/db/
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import { forceRefreshAccessToken, getValidAccessToken } from "../auth/session";
import { safeJsonParse } from "../utils/safe-json";

// ---------------------------------------------------------------------------
// REST base
// ---------------------------------------------------------------------------

export const REST_BASE = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";

// ---------------------------------------------------------------------------
// Auth headers + fetch helpers
// ---------------------------------------------------------------------------

const makeAuthHeaders = (token: string, extraHeaders?: Record<string, string>) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  ...(extraHeaders ?? {}),
});

const summarizeResponse = (text: string) => {
  if (!text) return "";
  const trimmed = text.trim();
  if (/^<!doctype|^<html/i.test(trimmed)) return "HTML response";
  return trimmed.replace(/\s+/g, " ").slice(0, 280);
};

const doFetch = (
  method: string,
  path: string,
  token: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
) =>
  fetch(REST_BASE + path, {
    method,
    headers: makeAuthHeaders(token, extraHeaders),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// ---------------------------------------------------------------------------
// supabaseRequest — authenticated request with token retry + 401 refresh
// ---------------------------------------------------------------------------

export const supabaseRequest = async (
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
) => {
  let token = await getValidAccessToken();
  if (!token) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      token = await getValidAccessToken();
      if (token) break;
    }
  }
  if (!token) throw new Error("Missing auth token");

  const startedAt = Date.now();
  let res = await doFetch(method, path, token, body, extraHeaders);

  if (res.status === 401) {
    const refreshed = await forceRefreshAccessToken();
    if (refreshed) res = await doFetch(method, path, refreshed, body, extraHeaders);
  }

  const ms = Date.now() - startedAt;
  const text = await res.text();
  const summary = summarizeResponse(text);
  const errorCategory =
    res.status === 401 || res.status === 403
      ? "auth"
      : res.status === 404
        ? "not_found"
        : "http_error";

  if (!res.ok) {
    Sentry.setContext("supabase_error", { category: errorCategory, status: res.status, method, path, ms });
  } else {
    Sentry.setContext("supabase_error", null);
  }
  Sentry.addBreadcrumb({
    category: "supabase",
    message: `${method} ${path}`,
    level: res.ok ? "info" : "error",
    data: { status: res.status, ms, response: summary || undefined, errorCategory: res.ok ? undefined : errorCategory },
  });
  if (!res.ok) throw new Error(`Supabase ${method} error: ${res.status} ${summary}`);
  return text;
};

export const supabaseGet = async <T>(path: string) => {
  const text = await supabaseRequest("GET", path);
  return safeJsonParse<T>(text, [] as T);
};

export const supabasePost = async <T>(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>
) => {
  const text = await supabaseRequest("POST", path, body, extraHeaders);
  if (!text) return [] as T;
  return safeJsonParse<T>(text, [] as T);
};

export const supabasePatch = async <T>(path: string, body: unknown) => {
  const text = await supabaseRequest("PATCH", path, body);
  if (!text) return [] as T;
  return safeJsonParse<T>(text, [] as T);
};

export const supabaseDelete = async (path: string) => {
  await supabaseRequest("DELETE", path);
};

// ---------------------------------------------------------------------------
// Cache keys + helpers
// ---------------------------------------------------------------------------

export const CACHE_KEYS = {
  classes: "cache_classes_v1",
  classPlans: "cache_class_plans_v1",
  classCompetitiveProfiles: "cache_class_competitive_profiles_v1",
  classCalendarExceptions: "cache_class_calendar_exceptions_v1",
  trainingPlans: "cache_training_plans_v1",
  trainingTemplates: "cache_training_templates_v1",
  students: "cache_students_v1",
};

export const readCache = async <T>(key: string): Promise<T | null> => {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;
    return safeJsonParse<T | null>(stored, null);
  } catch {
    return null;
  }
};

export const writeCache = async (key: string, value: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore cache write failures
  }
};

export async function clearLocalReadCaches() {
  try {
    await AsyncStorage.multiRemove(Object.values(CACHE_KEYS));
  } catch {
    // ignore cache clear failures
  }
}

// ---------------------------------------------------------------------------
// Organization scope helpers
// ---------------------------------------------------------------------------

export const ACTIVE_ORG_STORAGE_KEY = "active-org-id";

export const getActiveOrganizationId = async () => {
  try {
    return await AsyncStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const getScopedOrganizationId = async (
  candidate: string | null | undefined,
  feature: string
) => {
  const resolved = candidate ?? (await getActiveOrganizationId());
  if (resolved && resolved.trim()) return resolved;
  Sentry.addBreadcrumb({
    category: "org-scope",
    message: `Missing organization scope: ${feature}`,
    level: "warning",
    data: { hasCandidate: Boolean(candidate) },
  });
  if (__DEV__) console.warn(`[org-scope] Missing organization id for ${feature}`);
  return null;
};

// ---------------------------------------------------------------------------
// Error classifiers (used by nfc-sync and other modules)
// ---------------------------------------------------------------------------

export const isNetworkError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Network request failed") ||
    message.includes("Failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("NetworkError") ||
    message.includes("Timed out")
  );
};

export const isAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Missing auth token")) return true;
  return message.includes("Supabase") && (message.includes(" 401 ") || message.includes(" 403 "));
};

export const isPermissionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("row-level security") ||
    message.includes("code\":\"42501\"") ||
    message.includes(" 42501")
  );
};

export const isRetryableServerError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /\s5\d{2}\s/.test(message) || message.includes(" 429 ");
};

export const isBadRequestError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes(" 400 ") ||
    message.includes(" 404 ") ||
    message.includes(" 409 ") ||
    message.includes(" 422 ")
  );
};

export type PendingWriteErrorKind =
  | "network"
  | "retryable_server"
  | "auth"
  | "permission"
  | "bad_request"
  | "unknown";

export const classifyPendingWriteError = (error: unknown): PendingWriteErrorKind => {
  if (isNetworkError(error)) return "network";
  if (isRetryableServerError(error)) return "retryable_server";
  if (isAuthError(error)) return "auth";
  if (isPermissionError(error)) return "permission";
  if (isBadRequestError(error)) return "bad_request";
  return "unknown";
};

// ---------------------------------------------------------------------------
// DB relation / schema helpers (used by multiple domain modules)
// ---------------------------------------------------------------------------

export const isMissingRelation = (error: unknown, relation: string) => {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const rel = `public.${relation}`.toLowerCase();
  return (
    message.includes(`relation "public.${relation}"`) ||
    message.includes(`relation \"public.${relation}\"`) ||
    (lower.includes("could not find the table") && lower.includes(rel)) ||
    message.includes("does not exist")
  );
};

export const isMissingColumnInSchemaCache = (error: unknown, columnName: string) => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("schema cache") &&
    normalized.includes("could not find") &&
    normalized.includes(`'${columnName.toLowerCase()}'`)
  );
};

export const SYNC_PAUSE_PREFIX = "SYNC_PAUSED_";

export const buildSyncPauseError = (kind: "auth" | "permission") =>
  new Error(`${SYNC_PAUSE_PREFIX}${kind.toUpperCase()}`);
