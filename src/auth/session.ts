import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import { safeJsonParse } from "../utils/safe-json";

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email: string;
    email_confirmed_at?: string | null;
    confirmed_at?: string | null;
    app_metadata?: {
      provider?: string | null;
      providers?: string[] | null;
      email_verified_hybrid_at?: string | null;
      email_verification_source?: string | null;
      [key: string]: unknown;
    };
    identities?: {
      id?: string | null;
      identity_id?: string | null;
      provider?: string | null;
    }[] | null;
    created_at?: string;
    user_metadata?: {
      full_name?: string | null;
      name?: string | null;
      security_contact_email?: string | null;
      [key: string]: unknown;
    };
  };
};

const STORAGE_KEY = "auth_session_v1";
const LEGACY_REMEMBER_KEY = "auth_remember_me";
export const AUTH_REQUEST_TIMEOUT_MS = 5000;
const isNative = Platform.OS !== "web";
type SecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (
    key: string,
    value: string,
    options?: { keychainAccessible?: string }
  ) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
  WHEN_UNLOCKED: string;
};

let secureStoreModule: SecureStoreModule | null | undefined;

let accessToken = "";
let currentSession: AuthSession | null = null;

const fetchAuthWithTimeout = async (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutHandle);
  }
};

export const getAccessToken = () => accessToken;

const isWebStorage =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const removeWebKey = (key: string) => {
  if (!isWebStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const setWebKey = (key: string, value: string) => {
  if (!isWebStorage) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

const getSecureStore = (): SecureStoreModule | null => {
  if (!isNative) return null;
  if (secureStoreModule !== undefined) return secureStoreModule;
  try {
    // Lazy require avoids startup crash when native module is unavailable.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    secureStoreModule = require("expo-secure-store") as SecureStoreModule;
  } catch {
    secureStoreModule = null;
  }
  return secureStoreModule;
};

const deleteSecureSessionSafely = async (secureStore: SecureStoreModule | null) => {
  if (!secureStore) return;
  try {
    await secureStore.deleteItemAsync(STORAGE_KEY);
  } catch (error) {
    // Android may restore an encrypted payload whose keystore key disappeared
    // during reinstall. That stale value must never block the whole app boot.
    console.warn("[session] could not clear native session", error);
  }
};

export const loadSession = async (): Promise<AuthSession | null> => {
  const secureStore = getSecureStore();
  // `auth_remember_me` used to decide whether native sessions survived a JS
  // reload. A mobile session must persist securely regardless of the separate
  // "remember email" preference, so only clean the obsolete marker here.
  await AsyncStorage.removeItem(LEGACY_REMEMBER_KEY);
  removeWebKey(LEGACY_REMEMBER_KEY);
  let raw = "";
  if (isNative && secureStore) {
    try {
      raw = (await secureStore.getItemAsync(STORAGE_KEY)) ?? "";
    } catch (error) {
      // A restored SecureStore entry cannot be decrypted after Android has
      // recreated the app keystore. Recover as signed out instead of failing
      // BootstrapProvider and trapping the user on the startup error screen.
      console.warn("[session] native session is unreadable; starting signed out", error);
      await AsyncStorage.removeItem(STORAGE_KEY);
      await deleteSecureSessionSafely(secureStore);
      accessToken = "";
      currentSession = null;
      return null;
    }
    if (!raw) {
      const legacyRaw = await AsyncStorage.getItem(STORAGE_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
        try {
          await secureStore.setItemAsync(STORAGE_KEY, legacyRaw, {
            keychainAccessible: secureStore.WHEN_UNLOCKED,
          });
          await AsyncStorage.removeItem(STORAGE_KEY);
        } catch (error) {
          // Keep the valid legacy copy available for this and the next launch.
          console.warn("[session] could not migrate session to native storage", error);
        }
      }
    }
  } else {
    raw = (await AsyncStorage.getItem(STORAGE_KEY)) ?? "";
  }
  if (!raw) return null;
  try {
    const parsed = safeJsonParse<AuthSession | null>(raw, null);
    if (!parsed) {
      throw new Error("Invalid session payload");
    }
    accessToken = parsed.access_token ?? "";
    currentSession = parsed ?? null;
    return parsed;
  } catch {
    if (secureStore) {
      await deleteSecureSessionSafely(secureStore);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
    return null;
  }
};

/**
 * Loads the persisted session and confirms that it still belongs to a live
 * Supabase Auth user before navigation guards treat it as authenticated.
 *
 * Deleting an Auth user can leave a still-unexpired JWT in another browser
 * tab/device. A local payload alone is therefore not enough evidence that the
 * session is usable. Transient network/server failures keep the cached session
 * so an offline startup does not become an involuntary sign-out.
 */
export const loadValidatedSession = async (): Promise<AuthSession | null> => {
  const stored = await loadSession();
  if (!stored) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const mustRefresh = !stored.expires_at || nowSeconds >= stored.expires_at - 30;
  let activeSession = currentSession ?? stored;
  if (mustRefresh) {
    const refreshResult = await refreshSession();
    if (refreshResult.status === "revoked") return null;
    if (refreshResult.status === "transient") {
      // The cached JWT may be expired, but losing connectivity must not destroy
      // the local session. Online requests can retry refresh when connectivity
      // returns while offline-capable screens keep their local context.
      return refreshResult.session;
    }
    activeSession = refreshResult.session;
  }
  const token = activeSession.access_token;
  if (!token) return activeSession;

  try {
    const response = await fetchAuthWithTimeout(
      SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user",
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 401 || response.status === 403) {
      await saveSession(null, false);
      return null;
    }
    if (!response.ok) return currentSession ?? activeSession;

    const text = await response.text();
    const user = safeJsonParse<AuthSession["user"] | null>(text, null);
    if (!user?.id) return currentSession ?? activeSession;

    const next: AuthSession = {
      ...(currentSession ?? activeSession),
      access_token: token,
      user,
    };
    await saveSession(next);
    return next;
  } catch {
    return currentSession ?? activeSession;
  }
};

export const hasStoredSession = async (): Promise<boolean> => {
  if (!isNative) return false;
  const secureStore = getSecureStore();
  if (secureStore) {
    const raw = (await secureStore.getItemAsync(STORAGE_KEY)) ?? "";
    if (raw.trim()) return true;
  }
  const legacyRaw = (await AsyncStorage.getItem(STORAGE_KEY)) ?? "";
  return Boolean(legacyRaw.trim());
};

export const saveSession = async (
  session: AuthSession | null,
  _legacyRememberPreference?: boolean,
) => {
  const secureStore = getSecureStore();
  if (!session) {
    accessToken = "";
    currentSession = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    if (secureStore) {
      await secureStore.deleteItemAsync(STORAGE_KEY);
    }
    await AsyncStorage.removeItem(LEGACY_REMEMBER_KEY);
    removeWebKey(STORAGE_KEY);
    removeWebKey(LEGACY_REMEMBER_KEY);
    return;
  }
  accessToken = session.access_token ?? "";
  currentSession = session;
  if (isNative && secureStore) {
    await secureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session), {
      keychainAccessible: secureStore.WHEN_UNLOCKED,
    });
    await AsyncStorage.removeItem(STORAGE_KEY);
  } else {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  await AsyncStorage.removeItem(LEGACY_REMEMBER_KEY);
  setWebKey(STORAGE_KEY, JSON.stringify(session));
  removeWebKey(LEGACY_REMEMBER_KEY);
};

export const getSessionUserId = async (): Promise<string> => {
  if (!currentSession) {
    const stored = await loadSession();
    if (!stored) return "";
  }
  return currentSession!.user.id ?? "";
};

type RefreshSessionResult =
  | { status: "refreshed"; session: AuthSession }
  | { status: "revoked"; session: null }
  | { status: "transient"; session: AuthSession };

const refreshSession = async (): Promise<RefreshSessionResult> => {
  if (!currentSession) {
    const stored = await loadSession();
    if (!stored) return { status: "revoked", session: null };
  }
  if (!currentSession!.refresh_token) {
    await saveSession(null, false);
    return { status: "revoked", session: null };
  }
  const cachedSession = currentSession!;
  try {
    const res = await fetchAuthWithTimeout(
      SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: currentSession!.refresh_token }),
      }
    );
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        await saveSession(null, false);
        return { status: "revoked", session: null };
      }
      return { status: "transient", session: cachedSession };
    }
    const payload = safeJsonParse<AuthSession | null>(text, null);
    if (!payload?.access_token) {
      return { status: "transient", session: cachedSession };
    }
    const next: AuthSession = {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token ?? currentSession!.refresh_token,
      expires_at: payload.expires_at,
      user: payload.user ?? currentSession!.user,
    };
    await saveSession(next);
    return { status: "refreshed", session: next };
  } catch {
    return { status: "transient", session: cachedSession };
  }
};

export const forceRefreshAccessToken = async (): Promise<string> => {
  const result = await refreshSession();
  return result.status === "refreshed" ? result.session.access_token ?? "" : "";
};

export const getValidAccessToken = async (): Promise<string> => {
  if (!currentSession) {
    const stored = await loadSession();
    if (!stored) return "";
  }
  if (!currentSession) return "";
  const expiresAt = currentSession.expires_at;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!expiresAt) {
    return await forceRefreshAccessToken();
  }
  if (nowSeconds < expiresAt - 30) {
    return currentSession.access_token ?? "";
  }
  const result = await refreshSession();
  return result.status === "refreshed" ? result.session.access_token ?? "" : "";
};
