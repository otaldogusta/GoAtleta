import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { clearAiCache } from "../api/ai";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import { clearSentryUser, setSentryUser } from "../observability/sentry";
import { safeJsonParse } from "../utils/safe-json";
import type { AuthSession } from "./session";
import { loadSession, saveSession } from "./session";

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    redirectPath: string,
    fullName?: string
  ) => Promise<AuthSession | null>;
  signInWithOAuth: (provider: "google" | "facebook" | "apple", redirectPath: string) => Promise<void>;
  exchangeCodeForSession: (code: string) => Promise<void>;
  consumeAuthUrl: (url: string) => Promise<AuthSession | null>;
  resendSignupCode: (email: string, redirectPath?: string) => Promise<void>;
  verifySignupCode: (email: string, code: string) => Promise<void>;
  unlinkIdentityProvider: (provider: "google" | "facebook" | "apple") => Promise<void>;
  refreshUser: () => Promise<void>;
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
    const parsed = safeJsonParse<{
      code?: string;
      error?: string;
      error_code?: string;
      msg?: string;
      message?: string;
    } | null>(text, null);
    const detail =
      parsed?.msg ||
      parsed?.message ||
      parsed?.error ||
      parsed?.error_code ||
      parsed?.code ||
      text;
    throw new Error(detail || "Falha na autenticação.");
  }
  if (!text) return {};
  const parsed = safeJsonParse<Record<string, any> | null>(text, null);
  if (!parsed) {
    throw new Error("Resposta inválida do servidor de autenticação.");
  }
  return parsed;
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
  const payload = safeJsonParse<{
    id: string;
    email: string;
    email_confirmed_at?: string | null;
    confirmed_at?: string | null;
    app_metadata?: {
      provider?: string | null;
      providers?: string[] | null;
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
      [key: string]: unknown;
    };
  } | null>(text, null);
  if (!payload) return null;
  return payload.id ? payload : null;
};

const updateUserMetadata = async (
  accessToken: string,
  data: Record<string, unknown>
) => {
  if (!accessToken) return;
  const res = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
    method: "PUT",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Falha ao atualizar dados da conta.");
  }
};

const deleteUserIdentity = async (accessToken: string, identityId: string) => {
  if (!accessToken || !identityId) {
    throw new Error("Dados insuficientes para desvincular conta.");
  }
  const res = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user/identities/${encodeURIComponent(identityId)}`,
    {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    const parsed = safeJsonParse<{ error_code?: string; code?: string; msg?: string; message?: string } | null>(
      text,
      null
    );
    const errorCode = String(parsed?.error_code ?? parsed?.code ?? "").toLowerCase();
    if (errorCode === "manual_linking_disabled") {
      throw new Error(
        "Desvinculação desativada no Supabase. Ative o account linking/manual linking nas configurações de Auth para permitir desvincular Google."
      );
    }
    if (res.status === 404) {
      throw new Error("Identidade Google não encontrada para esta conta.");
    }
    const detail = parsed?.msg ?? parsed?.message ?? text;
    throw new Error(detail || "Falha ao desvincular provedor.");
  }
};

type UserIdentity = {
  id?: string | null;
  identity_id?: string | null;
  identityId?: string | null;
  identity_id_pk?: string | null;
  provider?: string | null;
};

const fetchUserIdentities = async (accessToken: string): Promise<UserIdentity[]> => {
  if (!accessToken) return [];
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user/identities`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return [];
  const text = await res.text();
  if (!text) return [];
  const parsed = safeJsonParse<unknown>(text, null);
  if (Array.isArray(parsed)) {
    return parsed as UserIdentity[];
  }
  if (parsed && typeof parsed === "object") {
    const maybe = parsed as { identities?: unknown };
    if (Array.isArray(maybe.identities)) {
      return maybe.identities as UserIdentity[];
    }
  }
  return [];
};

const resolveIdentityId = (identity: UserIdentity | undefined) =>
  String(
    identity?.identity_id
      ?? identity?.identityId
      ?? identity?.id
      ?? identity?.identity_id_pk
      ?? ""
  ).trim();

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
      setSession(initialSession ?? null);
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
  }, [session?.user?.id]);

  const signIn = useCallback(async (email: string, password: string, remember = true) => {
    const payload = await authFetch("/auth/v1/token?grant_type=password", {
      email,
      password,
    });
    const normalized = normalizeAuthSession(payload);
    const hydratedUser = await fetchUser(normalized.access_token);
    const next: AuthSession = {
      ...normalized,
      user: hydratedUser ?? normalized.user,
    };
    setSession(next);
    await saveSession(next, remember);
  }, []);

  const signUp = useCallback(async (email: string, password: string, redirectPath: string, fullName?: string) => {
    const redirectTo = redirectPath
      ? Platform.OS === "web"
        ? buildWebRedirectUrl(redirectPath)
        : buildRedirectUrl(redirectPath)
      : undefined;
    const cleanFullName = (fullName ?? "").trim();
    const body: Record<string, unknown> = {
      email,
      password,
    };
    body.data = {
      full_name: cleanFullName || undefined,
      name: cleanFullName || undefined,
      requires_email_hybrid_verification: true,
      email_verified_hybrid_at: null,
    };
    const payload = await authFetch(
      "/auth/v1/signup",
      body,
      redirectTo ? { redirectTo } : undefined
    );
    if (payload.access_token) {
      const normalized = normalizeAuthSession(payload);
      const hydratedUser = await fetchUser(normalized.access_token);
      const next: AuthSession = {
        ...normalized,
        user: hydratedUser ?? normalized.user,
      };
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
    if (!sessionData?.access_token) return null;
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

  const refreshUser = useCallback(async () => {
    if (!session?.access_token) return;
    const user = await fetchUser(session.access_token);
    if (!user) return;
    const next: AuthSession = {
      ...session,
      user,
    };
    setSession(next);
    await saveSession(next, true);
  }, [session]);

  const resendSignupCode = useCallback(async (email: string, redirectPath?: string) => {
    const cleanEmail = (email ?? "").trim();
    if (!cleanEmail) {
      throw new Error("Informe o e-mail para reenviar o código.");
    }
    const cleanPath = (redirectPath ?? "").trim();
    const redirectTo = cleanPath
      ? Platform.OS === "web"
        ? buildWebRedirectUrl(cleanPath)
        : buildRedirectUrl(cleanPath)
      : undefined;

    await authFetch(
      "/auth/v1/otp",
      {
        email: cleanEmail,
        create_user: false,
      },
      redirectTo ? { redirectTo } : undefined
    );
  }, []);

  const verifySignupCode = useCallback(async (email: string, code: string) => {
    const cleanEmail = (email ?? "").trim();
    const cleanCode = (code ?? "").trim();
    if (!cleanEmail) {
      throw new Error("Informe o e-mail da conta.");
    }
    if (!cleanCode) {
      throw new Error("Informe o código recebido por e-mail.");
    }

    let payload: Record<string, unknown> | null = null;
    let verifyToken = "";

    payload = await authFetch("/auth/v1/verify", {
      email: cleanEmail,
      token: cleanCode,
      type: "email",
    });
    verifyToken = String(payload.access_token ?? "");

    const metadataToken = verifyToken || session?.access_token || "";
    if (metadataToken) {
      await updateUserMetadata(metadataToken, {
        email_verified_hybrid_at: new Date().toISOString(),
      });
    }

    if (payload?.access_token) {
      const normalized = normalizeAuthSession(payload);
      const hydratedUser = await fetchUser(normalized.access_token);
      const next: AuthSession = {
        ...normalized,
        user: hydratedUser ?? normalized.user,
      };
      setSession(next);
      await saveSession(next, true);
      return;
    }

    if (session?.access_token) {
      const user = await fetchUser(session.access_token);
      if (user) {
        const next: AuthSession = {
          ...session,
          user,
        };
        setSession(next);
        await saveSession(next, true);
      }
    }
  }, [session]);

  const unlinkIdentityProvider = useCallback(
    async (provider: "google" | "facebook" | "apple") => {
      const token = session?.access_token ?? "";
      if (!token) {
        throw new Error("Sessão inválida. Faça login novamente.");
      }

      const remoteIdentities = await fetchUserIdentities(token);
      const latestUser = await fetchUser(token);
      const identities = [
        ...remoteIdentities,
        ...(latestUser?.identities ?? []),
        ...(session?.user?.identities ?? []),
      ];
      const target = identities.find(
        (item) => String(item?.provider ?? "").toLowerCase() === provider
      );
      const identityId = resolveIdentityId(target);
      if (!identityId) {
        throw new Error("Conta não vinculada ao provedor selecionado.");
      }

      await deleteUserIdentity(token, identityId);
      const refreshedUser = await fetchUser(token);
      if (refreshedUser && session) {
        const next: AuthSession = {
          ...session,
          user: refreshedUser,
        };
        setSession(next);
        await saveSession(next, true);
        return;
      }
      await refreshUser();
    },
    [refreshUser, session]
  );

  const signOut = useCallback(async () => {
    clearAiCache();
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
      resendSignupCode,
      verifySignupCode,
      unlinkIdentityProvider,
      refreshUser,
      resetPassword,
      signOut,
    }),
    [
      consumeAuthUrl,
      exchangeCodeForSession,
      loading,
      refreshUser,
      resendSignupCode,
      resetPassword,
      session,
      signIn,
      signInWithOAuth,
      signOut,
      signUp,
      unlinkIdentityProvider,
      verifySignupCode,
    ]
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
      resendSignupCode: async () => {},
      verifySignupCode: async () => {},
      unlinkIdentityProvider: async () => {},
      refreshUser: async () => {},
      resetPassword: async () => {},
      consumeAuthUrl: async () => null,
      signOut: async () => {},
    };
  }
  return context;
};
