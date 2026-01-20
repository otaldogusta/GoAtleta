import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import type { AuthSession } from "./session";
import { loadSession, saveSession } from "./session";
import { clearSentryUser, setSentryUser } from "../observability/sentry";

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signUp: (email: string, password: string) => Promise<AuthSession | null>;
  resetPassword: (email: string, redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const authFetch = async (path: string, body: Record<string, unknown>) => {
  const res = await fetch(SUPABASE_URL.replace(/\/$/, "") + path, {
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

export function AuthProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession?: AuthSession | null;
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
    const next: AuthSession = {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: payload.expires_at,
      user: payload.user,
    };
    setSession(next);
    await saveSession(next, remember);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const payload = await authFetch("/auth/v1/signup", { email, password });
    if (payload.access_token) {
      const next: AuthSession = {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        expires_at: payload.expires_at,
        user: payload.user,
      };
      setSession(next);
      await saveSession(next, true);
      return next;
    }
    setSession(null);
    await saveSession(null, false);
    return null;
  }, []);

  const resetPassword = useCallback(async (email: string, redirectTo?: string) => {
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
      resetPassword,
      signOut,
    }),
    [loading, resetPassword, session, signIn, signOut, signUp]
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
      resetPassword: async () => {},
      signOut: async () => {},
    };
  }
  return context;
};
