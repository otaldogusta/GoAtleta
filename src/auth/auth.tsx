import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import { clearSentryUser, setSentryUser } from "../observability/sentry";
import type { AuthSession } from "./session";
import { loadSession, saveSession } from "./session";

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signUp: (email: string, password: string, redirectPath: string) => Promise<AuthSession | null>;
  signInWithOAuth: (provider: "google" | "facebook" | "apple", redirectPath: string) => Promise<void>;
  exchangeCodeForSession: (code: string) => Promise<void>;
  consumeAuthUrl: (url: string) => Promise<AuthSession | null>;
  resetPassword: (email: string, redirectTo: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const normalizeAuthSession = (payload: Record<string, any>): AuthSession => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt =
    payload.expires_at ??
    (payload.expires_in && Number.isFinite(Number(payload.expires_in))
      ? nowSeconds + Number(payload.expires_in)
      : undefined);
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: expiresAt,
    user: payload.user,
  };
};

const authFetch = async (
  path: string,
  body: Record<string, unknown>,
  options?: { redirectTo?: string }
) => {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const redirectTo = options?.redirectTo ?? "";
  const redirect = redirectTo
    ? `${path.includes("?") ? "&" : "?"}redirect_to=${encodeURIComponent(
        redirectTo
      )}`
    : "";
  const res = await fetch(base + path + redirect, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || "Falha na autenticacao.");
  }
  return text ? (JSON.parse(text) as Record<string, any>) : {};
};

const parseAuthSession = (url: string) => {
  if (!url) return null;
  const [base, hash] = url.split("#");
  const query = hash || (base.includes("?") ? base.split("?")[1] : "");
  if (!query) return null;
  const params = new URLSearchParams(query);
  const accessToken = params.get("access_token") ?? "";
  if (!accessToken) return null;
  const refreshToken = params.get("refresh_token") ?? "";
  const expiresAtRaw = params.get("expires_at");
  const expiresInRaw = params.get("expires_in");
  const nowSeconds = Math.floor(Date.now() / 1000);
  let expiresAt: number | undefined;
  if (expiresAtRaw && Number.isFinite(Number(expiresAtRaw))) {
    expiresAt = Number(expiresAtRaw);
  } else if (expiresInRaw && Number.isFinite(Number(expiresInRaw))) {
    expiresAt = nowSeconds + Number(expiresInRaw);
  }
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
  } as AuthSession;
};

const buildRedirectUrl = (path: string) => {
  const normalized = (path ?? "login").replace(/^\/+/, "");
  return Linking.createURL(normalized);
};

const buildWebRedirectUrl = (path: string) => {
  if (typeof window === "undefined") return "";
  const normalized = (path ?? "").replace(/^\/+/, "");
  return normalized ? `${window.location.origin}/${normalized}` : window.location.origin;
};

const fetchUser = async (accessToken: string) => {
  const res = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text) return null;
  const payload = JSON.parse(text) as { id: string; email: string };
  return payload.id ? payload : null;
};

export function AuthProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: AuthSession | null;
}) {
  const [session, setSession] = useState<AuthSession | null>(
    initialSession ?? null
  );
  const [loading, setLoading] = useState(
    initialSession === undefined
  );

  useEffect(() => {
    let alive = true;
    if (initialSession !== undefined) {
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    (async () => {
      const stored = await loadSession();
      if (!alive) return;
      setSession(stored);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [initialSession]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (userId) {
      setSentryUser(userId);
    } else {
      clearSentryUser();
    }
  }, [session]);

  const signIn = useCallback(async (email: string, password: string, remember = true) => {
    const payload = await authFetch("/auth/v1/token?grant_type=password", {
      email,
      password,
    });
    const next = normalizeAuthSession(payload);
    setSession(next);
    await saveSession(next, remember);
  }, []);

  const signUp = useCallback(async (email: string, password: string, redirectPath: string) => {
    const redirectTo = redirectPath
      ? Platform.OS === "web"
        ? buildWebRedirectUrl(redirectPath)
        : buildRedirectUrl(redirectPath)
      : undefined;
    const payload = await authFetch(
      "/auth/v1/signup",
      { email, password },
      redirectTo ? { redirectTo } : undefined
    );
    if (payload.access_token) {
      const next = normalizeAuthSession(payload);
      setSession(next);
      await saveSession(next, true);
      return next;
    }
    setSession(null);
    await saveSession(null, false);
    return null;
  }, []);

  const signInWithOAuth = useCallback(
    async (provider: "google" | "facebook" | "apple", redirectPath: string) => {
      // For web, redirect directly to Supabase with custom scheme
      if (Platform.OS === "web") {
        const normalized = (redirectPath ?? "").replace(/^\/+/, "");
        const redirectTo = normalized
          ? `${window.location.origin}/${normalized}`
          : window.location.origin;
        const authUrl =
          SUPABASE_URL.replace(/\/$/, "") +
          `/auth/v1/authorize?provider=${encodeURIComponent(
            provider
          )}&response_type=code&redirect_to=${encodeURIComponent(
            redirectTo
          )}`;
        window.location.href = authUrl;
        return;
      }

      // For mobile, use WebBrowser
      const redirectTo = buildRedirectUrl(redirectPath);
      const authUrl =
        SUPABASE_URL.replace(/\/$/, "") +
        `/auth/v1/authorize?provider=${encodeURIComponent(
          provider
        )}&redirect_to=${encodeURIComponent(redirectTo)}&response_type=code&skip_http_redirect=true`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
      if (result.type !== "success") {
        throw new Error("OAuth cancelado.");
      }
      
      // Extract code from the URL
      const url = new URL(result.url);
      const code = url.searchParams.get("code");
      
      if (!code) {
        throw new Error("Falha ao autenticar.");
      }
      
      // Exchange code for session
      const payload = await authFetch("/auth/v1/token?grant_type=authorization_code", {
        code,
      });
      
      const next = normalizeAuthSession(payload);
      setSession(next);
      await saveSession(next, true);
    },
    []
  );

  const exchangeCodeForSession = useCallback(async (code: string) => {
    const payload = await authFetch("/auth/v1/token?grant_type=authorization_code", {
      code,
    });
    const next = normalizeAuthSession(payload);
    setSession(next);
    await saveSession(next, true);
  }, []);

  const consumeAuthUrl = useCallback(async (url: string) => {
    const sessionData = parseAuthSession(url);
    if (!sessionData.access_token) return null;
    const user = await fetchUser(sessionData.access_token);
    const next: AuthSession = {
      ...sessionData,
      user: user ?? sessionData.user,
    };
    setSession(next);
    await saveSession(next, true);
    return next;
  }, []);

  const resetPassword = useCallback(async (email: string, redirectTo: string) => {
    await authFetch("/auth/v1/recover", {
      email,
      redirect_to: redirectTo,
    });
  }, []);

  const signOut = useCallback(async () => {
    setSession(null);
    await saveSession(null, false);
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      signIn,
      signUp,
      signInWithOAuth,
      exchangeCodeForSession,
      consumeAuthUrl,
      resetPassword,
      signOut,
    }),
    [loading, resetPassword, session, signIn, signInWithOAuth, exchangeCodeForSession, consumeAuthUrl, signOut, signUp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      session: null,
      loading: false,
      signIn: async () => {},
      signUp: async () => null,
      signInWithOAuth: async () => {},
      exchangeCodeForSession: async () => {},
      resetPassword: async () => {},
      consumeAuthUrl: async () => null,
      signOut: async () => {},
    };
  }
  return context;
};

