import { forceRefreshAccessToken, getValidAccessToken } from "../auth/session";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

type RestMethod = "GET" | "POST" | "PATCH" | "DELETE";

type RestRequestOptions = {
  method?: RestMethod;
  body?: unknown;
  prefer?: "return=representation" | "return=minimal";
  additionalHeaders?: Record<string, string>;
};

const REST_BASE = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";

const parseResponse = async <T>(res: Response): Promise<T> => {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `REST request failed (${res.status})`);
  }
  if (!text) return null as T;
  return JSON.parse(text) as T;
};

const makeHeaders = (token: string, options: RestRequestOptions) => {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    ...options.additionalHeaders,
  };

  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
};

const requestWithToken = async (
  token: string,
  path: string,
  options: RestRequestOptions
): Promise<Response> => {
  const targetPath = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${REST_BASE}${targetPath}`, {
    method: options.method ?? "GET",
    headers: makeHeaders(token, options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
};

export const supabaseRestRequest = async <T>(
  path: string,
  options: RestRequestOptions = {}
): Promise<T> => {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Missing auth token");
  }

  let res = await requestWithToken(token, path, options);
  if (res.status === 401) {
    const refreshedToken = await forceRefreshAccessToken();
    if (refreshedToken) {
      res = await requestWithToken(refreshedToken, path, options);
    }
  }

  return parseResponse<T>(res);
};

export const supabaseRestGet = async <T>(path: string): Promise<T> =>
  supabaseRestRequest<T>(path, { method: "GET" });

export const supabaseRestPost = async <T>(
  path: string,
  body: unknown,
  prefer: "return=representation" | "return=minimal" = "return=representation"
): Promise<T> => supabaseRestRequest<T>(path, { method: "POST", body, prefer });

export const supabaseRestPatch = async <T>(
  path: string,
  body: unknown,
  prefer: "return=representation" | "return=minimal" = "return=representation"
): Promise<T> => supabaseRestRequest<T>(path, { method: "PATCH", body, prefer });

export const supabaseRestDelete = async <T>(
  path: string,
  prefer: "return=representation" | "return=minimal" = "return=minimal"
): Promise<T> => supabaseRestRequest<T>(path, { method: "DELETE", prefer });
