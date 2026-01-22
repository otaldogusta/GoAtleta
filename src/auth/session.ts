import AsyncStorage from "@react-native-async-storage/async-storage";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user?: {
    id?: string;
    email?: string;
  };
};

const STORAGE_KEY = "auth_session_v1";
const REMEMBER_KEY = "auth_remember_me";

let accessToken = "";
let currentSession: AuthSession | null = null;

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

export const loadSession = async (): Promise<AuthSession | null> => {
  const remember = await AsyncStorage.getItem(REMEMBER_KEY);
  if (remember !== "true") {
    await AsyncStorage.removeItem(STORAGE_KEY);
    removeWebKey(STORAGE_KEY);
    accessToken = "";
    currentSession = null;
    return null;
  }
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    accessToken = parsed?.access_token ?? "";
    currentSession = parsed ?? null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveSession = async (session: AuthSession | null, remember = true) => {
  if (!session) {
    accessToken = "";
    currentSession = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(REMEMBER_KEY);
    removeWebKey(STORAGE_KEY);
    removeWebKey(REMEMBER_KEY);
    return;
  }
  accessToken = session.access_token ?? "";
  currentSession = session;
  if (!remember) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.setItem(REMEMBER_KEY, "false");
    removeWebKey(STORAGE_KEY);
    setWebKey(REMEMBER_KEY, "false");
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  await AsyncStorage.setItem(REMEMBER_KEY, "true");
  setWebKey(STORAGE_KEY, JSON.stringify(session));
  setWebKey(REMEMBER_KEY, "true");
};

export const setRememberPreference = async (remember: boolean) => {
  if (remember) {
    await AsyncStorage.setItem(REMEMBER_KEY, "true");
    setWebKey(REMEMBER_KEY, "true");
    return;
  }
  accessToken = "";
  currentSession = null;
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.setItem(REMEMBER_KEY, "false");
  removeWebKey(STORAGE_KEY);
  setWebKey(REMEMBER_KEY, "false");
};

export const getSessionUserId = async (): Promise<string> => {
  if (!currentSession) {
    const stored = await loadSession();
    if (!stored) return "";
  }
  return currentSession?.user?.id ?? "";
};

const refreshSession = async (): Promise<AuthSession | null> => {
  if (!currentSession) {
    const stored = await loadSession();
    if (!stored) return null;
  }
  if (!currentSession?.refresh_token) {
    await saveSession(null, false);
    return null;
  }
  try {
    const res = await fetch(
      SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: currentSession.refresh_token }),
      }
    );
    const text = await res.text();
    if (!res.ok) {
      await saveSession(null, false);
      return null;
    }
    const payload = text ? (JSON.parse(text) as AuthSession) : null;
    if (!payload?.access_token) {
      await saveSession(null, false);
      return null;
    }
    const remember = (await AsyncStorage.getItem(REMEMBER_KEY)) === "true";
    const next: AuthSession = {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token ?? currentSession.refresh_token,
      expires_at: payload.expires_at,
      user: payload.user ?? currentSession.user,
    };
    await saveSession(next, remember);
    return next;
  } catch {
    await saveSession(null, false);
    return null;
  }
};

export const forceRefreshAccessToken = async (): Promise<string> => {
  const next = await refreshSession();
  return next?.access_token ?? "";
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
  return await forceRefreshAccessToken();
};
