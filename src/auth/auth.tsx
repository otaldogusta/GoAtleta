import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import type { AuthSession } from "./session";
import { loadSession, saveSession } from "./session";

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await loadSession();
      if (!alive) return;
      setSession(stored);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

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
      return;
    }
    setSession(null);
    await saveSession(null, false);
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
      signUp: async () => {},
      resetPassword: async () => {},
      signOut: async () => {},
    };
  }
  return context;
};
