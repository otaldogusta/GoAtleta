// ---------------------------------------------------------------------------
// Supabase REST client + cache + org scope helpers
// Shared infrastructure used by all domain modules in src/db/
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import {
  assertSessionIdentity, forceRefreshAccessToken, getSessionIdentity,
  getValidAccessToken, isSessionIdentityCurrent, SessionIdentityChangedError,
  subscribeSession, type SessionIdentity,
} from "../auth/session";
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

const summarizeErrorResponse = (text: string) => {
  const payload = safeJsonParse<{ code?: unknown; message?: unknown } | null>(text, null);
  const code = typeof payload?.code === "string" && /^(?:[A-Z0-9]{5}|PGRST\d{3})$/.test(payload.code)
    ? payload.code : "REQUEST_FAILED";
  // Schema compatibility checks need column/table names, never record values,
  // constraint details, emails, or arbitrary server error messages.
  const message = typeof payload?.message === "string" ? payload.message : "";
  const safeSchemaMessage = [
    /^Could not find the '[a-zA-Z0-9_]+' column of '[a-zA-Z0-9_]+' in the schema cache$/,
    /^Could not find the table '[a-zA-Z0-9_.]+' in the schema cache$/,
    /^(?:column|relation) ["a-zA-Z0-9_.]+ does not exist$/,
  ].some((pattern) => pattern.test(message)) ? message : "";
  return `${code}${safeSchemaMessage ? ` ${safeSchemaMessage}` : ""}`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SUPABASE_FETCH_TIMEOUT_MS = 20_000;

export class SupabaseRequestTimeoutError extends Error {
  constructor() {
    super("A conexão demorou demais. Verifique sua internet e tente novamente.");
    this.name = "SupabaseRequestTimeoutError";
  }
}

const fetchWithTimeout = async (
  input: string,
  init?: RequestInit,
  timeoutMs: number = SUPABASE_FETCH_TIMEOUT_MS
) => {
  const controller = new AbortController();
  const timeoutError = new SupabaseRequestTimeoutError();
  const timeoutId = setTimeout(() => {
    controller.abort(timeoutError);
  }, timeoutMs);
  const forwardAbort = () => {
    controller.abort(init?.signal?.reason ?? new Error("Request aborted"));
  };

  if (init?.signal) {
    if (init.signal.aborted) {
      clearTimeout(timeoutId);
      throw init.signal.reason ?? new Error("Request aborted");
    }
    init.signal.addEventListener("abort", forwardAbort, { once: true });
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.reason === timeoutError) {
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    init?.signal?.removeEventListener("abort", forwardAbort);
  }
};

const isTransientFetchError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Network request failed") ||
    message.includes("Failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("NetworkError") ||
    message.includes("TypeError: Failed to fetch") ||
    message.includes("Timed out")
  );
};

const doFetch = (
  method: string,
  path: string,
  token: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
  signal?: AbortSignal,
) =>
  fetchWithTimeout(REST_BASE + path, {
    method,
    headers: makeAuthHeaders(token, extraHeaders),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

// ---------------------------------------------------------------------------
// supabaseRequest — authenticated request with token retry + 401 refresh
// ---------------------------------------------------------------------------

export const supabaseRequest = async (
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
  expectedIdentity?: SessionIdentity,
) => {
  // Capture identity before any token refresh or asynchronous retry. A request
  // started by A may never be retried using B's session.
  const initialIdentity = expectedIdentity ?? getSessionIdentity();
  const requestCacheGeneration = cacheGeneration;
  const assertRequestContext = (identity: SessionIdentity) => {
    assertSessionIdentity(identity);
    if (requestCacheGeneration !== cacheGeneration) throw new SessionIdentityChangedError();
  };
  let token = await getValidAccessToken();
  const identity = initialIdentity.userId ? initialIdentity : getSessionIdentity();
  assertRequestContext(identity);
  if (!token) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      token = await getValidAccessToken();
      assertRequestContext(identity);
      if (token) break;
    }
  }
  if (!token) {
    throw new Error("Sessão expirada. Entre novamente.");
  }

  const startedAt = Date.now();
  const maxAttempts = method === "GET" ? 3 : 1;
  let res: Response | null = null;
  let lastError: unknown = null;
  const identityAbort = new AbortController();
  const unsubscribe = subscribeSession(() => {
    if (!isSessionIdentityCurrent(identity)) identityAbort.abort(new SessionIdentityChangedError());
  });

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        assertRequestContext(identity);
        res = await doFetch(method, path, token, body, extraHeaders, identityAbort.signal);

        if (res.status === 401) {
          const refreshed = await forceRefreshAccessToken();
          assertRequestContext(identity);
          if (refreshed) {
            token = refreshed;
            res = await doFetch(method, path, token, body, extraHeaders, identityAbort.signal);
          }
        }

        if (method === "GET" && res.status >= 500 && attempt < maxAttempts - 1) {
          await sleep(150 * (attempt + 1));
          continue;
        }
        break;
      } catch (error) {
        lastError = error;
        if (
          error instanceof SupabaseRequestTimeoutError ||
          method !== "GET" ||
          !isTransientFetchError(error) ||
          attempt >= maxAttempts - 1
        ) {
          throw error;
        }
        await sleep(150 * (attempt + 1));
      }
    }

    if (!res) {
      throw lastError instanceof Error ? lastError : new Error("Falha ao conectar com o Supabase.");
    }

    const ms = Date.now() - startedAt;
    const text = await res.text();
    assertRequestContext(identity);
    const summary = res.ok ? "" : summarizeErrorResponse(text);
    const endpoint = path.split("?")[0].replace(/[^a-zA-Z0-9_/-]/g, "").slice(0, 100);
    const errorCategory =
      res.status === 401 || res.status === 403
        ? "auth"
        : res.status === 404
          ? "not_found"
          : "http_error";

    if (!res.ok) {
      Sentry.setContext("supabase_error", { category: errorCategory, status: res.status, method, endpoint, ms });
    } else {
      Sentry.setContext("supabase_error", null);
    }
    Sentry.addBreadcrumb({
      category: "supabase",
      message: `${method} ${endpoint}`,
      level: res.ok ? "info" : "error",
      data: { status: res.status, ms, errorCategory: res.ok ? undefined : errorCategory },
    });
    if (!res.ok) throw new Error(`Supabase ${method} error: ${res.status} ${summary}`);
    return text;
  } finally {
    unsubscribe();
  }
};

export const supabaseGet = async <T>(path: string) => {
  const text = await supabaseRequest("GET", path);
  return safeJsonParse<T>(text, [] as T);
};

export const supabasePost = async <T>(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
  identity?: SessionIdentity,
) => {
  const text = await supabaseRequest("POST", path, body, extraHeaders, identity);
  if (!text) return [] as T;
  return safeJsonParse<T>(text, [] as T);
};

export const supabasePatch = async <T>(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
  identity?: SessionIdentity,
) => {
  const text = await supabaseRequest("PATCH", path, body, extraHeaders, identity);
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
  attendanceRecords: "cache_attendance_records_v1",
  trainingPlans: "cache_training_plans_v1",
  trainingTemplates: "cache_training_templates_v1",
  students: "cache_students_v1",
};

const READ_CACHE_PREFIX = "read-cache:v2:";
let cacheGeneration = 0;
const isReadCache = (key: string) => Object.values(CACHE_KEYS).some(
  (base) => key === base || key.startsWith(`${base}_`),
);
const resolveCacheKey = async (key: string, identity: SessionIdentity) => {
  if (!isReadCache(key)) return key; // Pending writes are durable, never read caches.
  const organizationId = await getActiveOrganizationId();
  if (!identity.userId || !organizationId || !isSessionIdentityCurrent(identity)) return null;
  return `${READ_CACHE_PREFIX}${encodeURIComponent(identity.userId)}:${encodeURIComponent(organizationId)}:${key}`;
};

export const readCache = async <T>(key: string): Promise<T | null> => {
  try {
    const identity = getSessionIdentity();
    const generation = cacheGeneration;
    const scopedKey = await resolveCacheKey(key, identity);
    if (!scopedKey) return null;
    const stored = await AsyncStorage.getItem(scopedKey);
    if (isReadCache(key) && (!isSessionIdentityCurrent(identity) || generation !== cacheGeneration)) return null;
    if (!stored) return null;
    return safeJsonParse<T | null>(stored, null);
  } catch {
    return null;
  }
};

export const writeCache = async (key: string, value: unknown) => {
  try {
    const identity = getSessionIdentity();
    const generation = cacheGeneration;
    const scopedKey = await resolveCacheKey(key, identity);
    if (!scopedKey || (isReadCache(key) && generation !== cacheGeneration)) return;
    await AsyncStorage.setItem(scopedKey, JSON.stringify(value));
    if (isReadCache(key) && (!isSessionIdentityCurrent(identity) || generation !== cacheGeneration)) {
      await AsyncStorage.removeItem(scopedKey);
    }
  } catch {
    // ignore cache write failures
  }
};

export async function clearLocalReadCaches() {
  cacheGeneration += 1;
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((key) => isReadCache(key) || key.startsWith(READ_CACHE_PREFIX)));
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
  if (error instanceof SupabaseRequestTimeoutError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Network request failed") ||
    message.includes("Failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("NetworkError") ||
    message.includes("Timed out")
  );
};

// A request interrupted by account/workspace switching may already have been
// submitted. Preserve its idempotent draft under the captured original owner.
export const isDeferredWriteError = (error: unknown) =>
  isNetworkError(error) || error instanceof SessionIdentityChangedError;

export const isAuthError = (error: unknown) => {
  if (error instanceof SessionIdentityChangedError) return true;
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (message.includes("Missing auth token")) return true;
  if (lower.includes("sessao expirada") || lower.includes("sessão expirada")) return true;
  if (lower.includes("faca login novamente") || lower.includes("faça login novamente")) return true;
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
