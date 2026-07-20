import {
    Stack,
    useGlobalSearchParams,
    usePathname,
    useRootNavigationState,
    useRouter,
} from "expo-router";
import "../src/ui/web-font-timeout-fallback";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";
import {
    ActivityIndicator,
    AppState,
    LogBox,
    Platform, Text,
    View
} from "react-native";
import { Pressable } from "../src/ui/Pressable";

import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuth } from "../src/auth/auth";
import {
    getPendingInvite,
    resolveAuthenticatedTrainerInviteEntry,
    savePendingTrainerInvite,
} from "../src/auth/pending-invite";
import { buildLoginRedirectHref, sanitizePostLoginRedirect } from "../src/auth/post-login-redirect";
import { RoleProvider, useRole } from "../src/auth/role";
import {
    getTrainerPermissionKey,
    hybridVerificationRestrictedPrefixes,
    studentOnlyRoutes,
    trainerOnlyPrefixes,
} from "../src/auth/route-permissions";
import { BootstrapProvider, useBootstrap } from "../src/bootstrap/BootstrapProvider";
import { resolveBootStatus } from "../src/bootstrap/boot-status";
import { PedagogicalConfigProvider } from "../src/bootstrap/pedagogical-config-context";
import { ScreenBackdrop } from "../src/components/ui/ScreenBackdrop";
import { CopilotProvider } from "../src/copilot/CopilotProvider";
import { useEffectiveProfile } from "../src/core/effective-profile";
import { logNavigation } from "../src/observability/breadcrumbs";
import { setSentryBaseTags } from "../src/observability/sentry";
import { VercelWebAnalytics } from "../src/observability/VercelWebAnalytics";
import { OrganizationProvider, useOptionalOrganization } from "../src/providers/OrganizationProvider";
import {
    ensureAndroidNotificationChannel,
    ensureNotificationHandlerConfigured,
} from "../src/push/notificationRuntime";
import { attachPushListeners, ensurePushTokenRegistered } from "../src/push/pushClient";
import { BiometricLockProvider, useBiometricLock } from "../src/security/biometric-lock";
import { AppThemeProvider, useAppTheme } from "../src/ui/app-theme";
import { ConfirmDialogProvider } from "../src/ui/confirm-dialog";
import { ConfirmUndoProvider } from "../src/ui/confirm-undo";
import { GuidanceProvider } from "../src/ui/guidance";
import { RootWebShell } from "../src/ui/RootWebShell";
import { SaveToastProvider } from "../src/ui/save-toast";
import { WhatsAppSettingsProvider } from "../src/ui/whatsapp-settings-context";
import { ptBR } from "../src/constants/copy/pt-br";

const enableSentryPii = __DEV__;
const enableSentryLogs = __DEV__;
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: enableSentryPii,

  // Enable Logs
  enableLogs: enableSentryLogs,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

function safeReplaceHistoryUrl(url: string) {
  if (Platform.OS !== "web") return;
  if (typeof window === "undefined") return;
  try {
    const currentState = window.history.state;
    // React Navigation expects its own history payload shape on web.
    // Replacing an undefined state with null can corrupt stack rehydration.
    if (currentState === undefined || currentState === null) return;
    window.history.replaceState(currentState, "", url);
  } catch {
    // Non-blocking fallback for restrictive browser environments.
  }
}

function RootErrorFallback({
  error,
  resetError,
}: {
  error: unknown;
  resetError: () => void;
}) {
  const { colors } = useAppTheme();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      resetError();

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          window.location.reload();
          return;
        }
        return;
      }

      await Updates.reloadAsync();
    } catch {
      resetError();
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, resetError]);

  useEffect(() => {
    console.error("Root error boundary caught", error);
  }, [error]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
        padding: 16,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: 20,
          gap: 14,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 2 }}>
          {ptBR.errors.appCrashed}
        </Text>
        <Pressable
          onPress={() => {
            void handleRetry();
          }}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 12,
            backgroundColor: colors.primaryBg,
            opacity: isRetrying ? 0.72 : 1,
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "600" }}>
            {isRetrying ? ptBR.common.feedback.reloading : ptBR.common.actions.retry}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function RootLayoutContent() {
  const { colors, mode } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { inviteCode: entryInviteCode } = useGlobalSearchParams<{
    inviteCode?: string;
  }>();
  const lastPathRef = useRef<string | null>(null);
  const { loading: bootstrapLoading, error: bootstrapError, retry: retryBootstrap } =
    useBootstrap();
  const rootState = useRootNavigationState();
  const { session, loading, exchangeCodeForSession, consumeAuthUrl } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const effectiveProfile = useEffectiveProfile();
  const organization = useOptionalOrganization();
  const {
    activeOrganization,
    memberPermissions,
    permissionsLoading,
    isLoading: organizationLoading,
  } = organization ?? {
    activeOrganization: null,
    memberPermissions: {},
    permissionsLoading: false,
    isLoading: false,
  };
  const { isEnabled: biometricsEnabled, isUnlocked, hasCredentialLoginBypass } = useBiometricLock();
  const hadSessionRef = useRef(false);
  const initialRouteGuardAppliedRef = useRef(false);
  const stuckEventsGuardRef = useRef(false);
  const appStartedAtRef = useRef(Date.now());
  const lastBootPhaseRef = useRef<string | null>(null);
  const pushRegistrationInFlightRef = useRef(false);
  const lastPushRegistrationKeyRef = useRef("");
  const oauthHandledHrefRef = useRef("");
  const oauthInFlightRef = useRef(false);
  const navReady = Boolean(rootState?.key);
  const isAdminProfile = role === "trainer" && (activeOrganization?.role_level ?? 0) >= 50;
  const appHomeHref =
    role === "student"
      ? "/student/home"
      : isAdminProfile
        ? "/coord/dashboard"
        : "/prof/home";
  const bootStatus = resolveBootStatus({
    bootstrapLoading,
    authLoading: loading,
    navReady,
    roleLoading,
    organizationLoading,
    permissionsLoading,
    hasSession: Boolean(session),
    role,
  });
  const isBooting = bootStatus.blocking;
  const [bootElapsedMs, setBootElapsedMs] = useState(0);
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false);
  const publicRoutes = [
    "/onboarding",
    "/welcome",
    "/login",
    "/signup",
    "/verify-email",
    "/reset-password",
    ...(__DEV__ ? ["/admin"] : []),
  ];
  const publicPrefixes = ["/invite"];
  const normalizedPathname =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const isDevStudentConsultationPreview =
    __DEV__ &&
    Platform.OS === "web" &&
    normalizedPathname === "/student-consultation" &&
    typeof window !== "undefined" &&
    (() => {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.has("devStudentId") || searchParams.has("devStudentEmail");
    })();
  const isInviteRoute =
    normalizedPathname === "/invite" || normalizedPathname.startsWith("/invite/");
  const emailConfirmedAt =
    session?.user?.email_confirmed_at ?? session?.user?.confirmed_at ?? null;
  const userMetadata = session?.user?.user_metadata ?? {};
  const hybridVerifiedAt =
    typeof userMetadata.email_verified_hybrid_at === "string"
      ? userMetadata.email_verified_hybrid_at
      : null;
  const requiresHybridVerification =
    userMetadata.requires_email_hybrid_verification === true;
  const providerValues = [
    ...(session?.user?.app_metadata?.providers ?? []),
    ...(session?.user?.identities?.map((item) => item.provider ?? "") ?? []),
    session?.user?.app_metadata?.provider ?? "",
  ]
    .map((item) => String(item).toLowerCase().trim())
    .filter(Boolean);
  const usesGoogleAuth = providerValues.includes("google");
  const isHybridEmailVerified = requiresHybridVerification
    ? Boolean(hybridVerifiedAt)
    : Boolean(emailConfirmedAt || hybridVerifiedAt);
  const needsHybridEmailVerification =
    Boolean(session) && !usesGoogleAuth && !isHybridEmailVerified;
  const isPublicRoute =
    publicRoutes.includes(normalizedPathname) ||
    publicPrefixes.some(
      (prefix) =>
        normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`)
    );

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof document === "undefined") return;

    const styleId = "sentry-feedback-position-override";
    const existing = document.getElementById(styleId);
    if (existing) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      #sentry-feedback {
        --page-margin: 16px !important;
        --inset: auto 0 calc(env(safe-area-inset-bottom, 0px) + 108px) auto !important;
        --actor-inset: var(--inset) !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  const shouldShowEmailVerifyBanner =
    Boolean(session) &&
    !isPublicRoute &&
    !isInviteRoute &&
    needsHybridEmailVerification &&
    !emailBannerDismissed;

  useEffect(() => {
    if (!isBooting) {
      setBootElapsedMs(0);
      return;
    }

    const startedAt = Date.now();
    setBootElapsedMs(0);
    const interval = setInterval(() => {
      setBootElapsedMs(Date.now() - startedAt);
    }, 500);
    return () => clearInterval(interval);
  }, [bootStatus.phase, isBooting]);

  useEffect(() => {
    if (lastBootPhaseRef.current === bootStatus.phase) return;
    lastBootPhaseRef.current = bootStatus.phase;
    if (__DEV__) {
      console.log(`[boot] phase=${bootStatus.phase} blocking=${bootStatus.blocking}`);
    }
    Sentry.addBreadcrumb({
      category: "boot",
      message: `phase:${bootStatus.phase}`,
      data: { blocking: bootStatus.blocking },
      level: "info",
    });
  }, [bootStatus.blocking, bootStatus.phase]);

  useEffect(() => {
    setEmailBannerDismissed(false);
  }, [session?.user?.id, emailConfirmedAt]);

  useEffect(() => {
    LogBox.ignoreLogs([
      "Looks like you have configured linking in multiple places.",
    ]);
  }, []);

  useEffect(() => {
    if (!pathname) return;
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    logNavigation(pathname);
  }, [pathname]);

  const registerPushTokenIfNeeded = useCallback(() => {
    const organizationId = activeOrganization?.id ?? "";
    const userId = session?.user?.id ?? "";
    if (!organizationId || !userId) {
      lastPushRegistrationKeyRef.current = "";
      return;
    }

    const registrationKey = `${userId}:${organizationId}`;
    if (pushRegistrationInFlightRef.current) return;
    if (lastPushRegistrationKeyRef.current === registrationKey) return;

    pushRegistrationInFlightRef.current = true;
    void ensurePushTokenRegistered({ organizationId })
      .then(() => {
        lastPushRegistrationKeyRef.current = registrationKey;
      })
      .catch(() => {
        // Keep key unset on failure so app-active can retry later.
      })
      .finally(() => {
        pushRegistrationInFlightRef.current = false;
      });
  }, [activeOrganization?.id, session?.user?.id]);

  useEffect(() => {
    const detach = attachPushListeners({
      push: (value) => router.push(value as never),
    });
    return () => detach();
  }, [router]);

  useEffect(() => {
    registerPushTokenIfNeeded();
  }, [registerPushTokenIfNeeded]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      registerPushTokenIfNeeded();
    });
    return () => subscription.remove();
  }, [registerPushTokenIfNeeded]);

  useEffect(() => {
    const hadSession = hadSessionRef.current;
    const hasSession = Boolean(session);
    hadSessionRef.current = hasSession;
    if (!hadSession && hasSession && normalizedPathname.startsWith("/events")) {
      router.replace(appHomeHref);
    }
  }, [appHomeHref, normalizedPathname, router, session]);

  useEffect(() => {
    if (initialRouteGuardAppliedRef.current) return;
    if (bootstrapLoading || !navReady || loading) return;
    initialRouteGuardAppliedRef.current = true;

    // Guard against stale deep-link/navigation state restoring users into /events on app boot.
    if (session && normalizedPathname === "/events") {
      router.replace(appHomeHref);
    }
  }, [appHomeHref, bootstrapLoading, loading, navReady, normalizedPathname, router, session]);

  useEffect(() => {
    if (stuckEventsGuardRef.current) return;
    if (bootstrapLoading || !navReady || loading) return;
    if (normalizedPathname !== "/events") return;

    const routeCount = Array.isArray(rootState?.routes) ? rootState.routes.length : 0;
    const elapsedMs = Date.now() - appStartedAtRef.current;
    if (routeCount <= 1 && elapsedMs < 15_000) {
      stuckEventsGuardRef.current = true;
      router.replace(appHomeHref);
    }
  }, [appHomeHref, bootstrapLoading, loading, navReady, normalizedPathname, rootState?.routes, router]);

  useEffect(() => {
    // If web OAuth code is present, let the code-exchange effect handle navigation first
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const searchCode = new URLSearchParams(window.location.search).get("code");
      if (searchCode) return;
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const type = params.get("type");
        if (accessToken && type !== "recovery") return;
      }
    }

    if (bootstrapLoading || !navReady || loading) return;

    let redirectTo: string | null = null;
    const trainerInviteCode = resolveAuthenticatedTrainerInviteEntry({
      hasSession: Boolean(session),
      pathname: normalizedPathname,
      routeCode: typeof entryInviteCode === "string" ? entryInviteCode : undefined,
    });

    if (trainerInviteCode) {
      void savePendingTrainerInvite(trainerInviteCode).then(() => {
        router.replace("/pending");
      });
      return;
    }

    if (normalizedPathname === "/onboarding") {
      redirectTo = session ? appHomeHref : "/welcome";
    } else if (session && ["/onboarding", "/welcome", "/login", "/signup"].includes(normalizedPathname)) {
      redirectTo = appHomeHref;
    } else if (!session && normalizedPathname === "/") {
      redirectTo = "/welcome";
    } else if (!session && !isPublicRoute) {
      if (Platform.OS === "web") {
        const elapsedMs = Date.now() - appStartedAtRef.current;
        if (elapsedMs < 2500) {
          return;
        }
      }
      const currentRoute =
        Platform.OS === "web" && typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : normalizedPathname;
      redirectTo = buildLoginRedirectHref(currentRoute);
    }

    if (redirectTo) {
      if (redirectTo !== normalizedPathname) {
        router.replace(redirectTo as Parameters<typeof router.replace>[0]);
      }
      return;
    }

    if (roleLoading) return;
    if (session && role === "trainer" && (permissionsLoading || organizationLoading)) return;

    if (
      session &&
      Platform.OS !== "web" &&
      biometricsEnabled &&
      !isUnlocked &&
      !hasCredentialLoginBypass &&
      normalizedPathname !== "/" &&
      normalizedPathname !== "/login" &&
      normalizedPathname !== "/reset-password" &&
      !isInviteRoute
    ) {
      if (normalizedPathname !== "/login") {
        router.replace("/login");
      }
      return;
    }

    if (session && role === "pending" && normalizedPathname !== "/pending" && !isInviteRoute) {
      router.replace("/pending");
      return;
    }
    if (session && role === "student") {
      const blocked = trainerOnlyPrefixes.some((prefix) =>
        normalizedPathname.startsWith(prefix)
      );
      if (blocked) {
        router.replace(appHomeHref);
        return;
      }
    }
    if (
      session &&
      role === "trainer" &&
      !isDevStudentConsultationPreview &&
      (studentOnlyRoutes.includes(normalizedPathname) ||
        normalizedPathname.startsWith("/student"))
    ) {
      router.replace(appHomeHref);
      return;
    }
    if (
      session &&
      role === "trainer" &&
      effectiveProfile !== "admin" &&
      (normalizedPathname === "/coord" ||
        normalizedPathname.startsWith("/coord/") ||
        normalizedPathname === "/coordination" ||
        normalizedPathname.startsWith("/coordination/"))
    ) {
      router.replace("/prof/home");
      return;
    }
    if (session && role === "trainer" && !isAdminProfile) {
      const permissionKey = getTrainerPermissionKey(normalizedPathname);
      if (permissionKey && memberPermissions[permissionKey] === false) {
        router.replace(appHomeHref);
        return;
      }
    }

    if (
      session &&
      role === "trainer" &&
      needsHybridEmailVerification &&
      normalizedPathname !== "/verify-email"
    ) {
      const blockedByHybrid = hybridVerificationRestrictedPrefixes.some(
        (prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`)
      );
      if (blockedByHybrid) {
        const email = encodeURIComponent(session.user?.email ?? "");
        router.replace(`/verify-email?email=${email}`);
        return;
      }
    }
  }, [
    biometricsEnabled,
    isInviteRoute,
    isPublicRoute,
    hasCredentialLoginBypass,
    isUnlocked,
    isDevStudentConsultationPreview,
    effectiveProfile,
    entryInviteCode,
    loading,
    memberPermissions,
    navReady,
    normalizedPathname,
    needsHybridEmailVerification,
    permissionsLoading,
    bootstrapLoading,
    router,
    role,
    roleLoading,
    session,
    isAdminProfile,
    appHomeHref,
    organizationLoading,
  ]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined") return;

    const authHref = window.location.href;
    if (oauthHandledHrefRef.current === authHref || oauthInFlightRef.current) return;

    // Process OAuth code from query params
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
      const nextAfterAuth = sanitizePostLoginRedirect(urlParams.get("next"));
      oauthHandledHrefRef.current = authHref;
      oauthInFlightRef.current = true;
      const redirectAfterAuth = async () => {
        const pending = await getPendingInvite();
        const destination = pending ? `/invite/${pending}` : nextAfterAuth ?? "/";
        router.replace(destination as Parameters<typeof router.replace>[0]);
      };
      exchangeCodeForSession(code).then(async () => {
        // Clean up URL
        const newUrl = window.location.origin + window.location.pathname;
        safeReplaceHistoryUrl(newUrl);
        await redirectAfterAuth();
      }).catch(() => {
        router.replace("/welcome");
      }).finally(() => {
        oauthInFlightRef.current = false;
      });
      return;
    }

    // Process password recovery from hash
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const type = params.get("type");
    const accessToken = params.get("access_token");
    if (type === "recovery" && accessToken) {
      oauthHandledHrefRef.current = authHref;
      const next = `/reset-password?access_token=${encodeURIComponent(accessToken)}`;
      window.location.replace(next);
      return;
    }
    if (accessToken && type !== "recovery") {
      const searchParams = new URLSearchParams(window.location.search);
      const nextAfterAuth = sanitizePostLoginRedirect(searchParams.get("next"));
      oauthHandledHrefRef.current = authHref;
      oauthInFlightRef.current = true;
      const redirectAfterAuth = async () => {
        const pending = await getPendingInvite();
        const destination = pending ? `/invite/${pending}` : nextAfterAuth ?? "/";
        router.replace(destination as Parameters<typeof router.replace>[0]);
      };
      consumeAuthUrl(window.location.href).then(async () => {
        const cleanUrl = window.location.origin + window.location.pathname;
        safeReplaceHistoryUrl(cleanUrl);
        await redirectAfterAuth();
      }).catch(() => {
        const cleanUrl = window.location.origin + window.location.pathname;
        safeReplaceHistoryUrl(cleanUrl);
        router.replace("/welcome");
      }).finally(() => {
        oauthInFlightRef.current = false;
      });
      return;
    }
  }, [exchangeCodeForSession, router, consumeAuthUrl]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof document === "undefined") return;
    const styleId = "app-autofill-fix";
    const css = `
input:focus,
textarea:focus,
select:focus {
  outline: none;
  box-shadow: none;
}
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: none;
  box-shadow: none;
}
input,
textarea {
  -webkit-tap-highlight-color: transparent;
}
html,
body,
input,
textarea,
select {
  color-scheme: dark;
}
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
input:-webkit-autofill:active,
input:-internal-autofill-selected,
input:-internal-autofill-previewed,
textarea:-webkit-autofill,
textarea:-webkit-autofill:hover,
textarea:-webkit-autofill:focus,
textarea:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 1000px ${colors.inputBg} inset !important;
  box-shadow: 0 0 0 1000px ${colors.inputBg} inset !important;
  background-color: ${colors.inputBg} !important;
  -webkit-text-fill-color: ${colors.inputText} !important;
  caret-color: ${colors.inputText} !important;
  transition: background-color 9999s ease-out 0s;
  background-clip: padding-box;
  -webkit-background-clip: padding-box;
  filter: none !important;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 14px;
}
html, body {
  scrollbar-width: thin;
  scrollbar-color: ${colors.border} transparent;
  scrollbar-gutter: stable;
}
* {
  scrollbar-gutter: auto;
}
*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background-color: ${colors.border};
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
*::-webkit-scrollbar-thumb:hover {
  background-color: ${colors.muted};
}
body.dropdown-scrollbars {
  scrollbar-width: thin;
  scrollbar-color: ${colors.border} transparent;
}
body.dropdown-scrollbars,
html.dropdown-scrollbars {
  scrollbar-gutter: stable;
}
body.dropdown-scrollbars *::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
body.dropdown-scrollbars *::-webkit-scrollbar-track {
  background: transparent;
}
body.dropdown-scrollbars *::-webkit-scrollbar-thumb {
  background-color: ${colors.border};
  opacity: 1;
}
body.dropdown-scrollbars *::-webkit-scrollbar-thumb:hover {
  background-color: ${colors.muted};
}
`;
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    if (style.textContent !== css) {
      style.textContent = css;
    }
  }, [colors.inputBg, colors.inputText, colors.border, colors.muted]);

  if (bootstrapError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenBackdrop variant="boot" />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 12,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Ocorreu um erro ao iniciar
          </Text>
          <Text style={{ color: colors.muted, textAlign: "center" }}>
            Tente novamente. Se persistir, reinicie o app.
          </Text>
          <Pressable
            onPress={retryBootstrap}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: colors.primaryBg,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>Tentar novamente</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isBooting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenBackdrop variant="boot" />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <ActivityIndicator size="large" color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "600" }}>
            {__DEV__ && bootElapsedMs >= 2500 ? bootStatus.label : "Carregando..."}
          </Text>
        </View>
        <StatusBar
          style={mode === "dark" ? "light" : "dark"}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackdrop />
      <StatusBar
        style={mode === "dark" ? "light" : "dark"}
      />
      <RootWebShell>
        {shouldShowEmailVerifyBanner ? (
          <View
            style={{
              marginHorizontal: 12,
              marginTop: Platform.OS === "web" ? 10 : 6,
              marginBottom: 6,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={{ color: colors.muted, flex: 1 }}>
              Confirme seu e-mail para manter sua conta segura e recuperar acesso com facilidade.
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() => {
                  const email = encodeURIComponent(session?.user?.email ?? "");
                  router.push(`/verify-email?email=${email}`);
                }}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                  Confirmar
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setEmailBannerDismissed(true)}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                  Depois
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <Stack
          screenOptions={{
            headerShown: false,
            headerTitleAlign: "center",
            contentStyle: { backgroundColor: colors.background },
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        >
          <Stack.Screen
            name="events/[id]"
            options={
              Platform.OS === "web"
                ? {
                    presentation: "transparentModal",
                    animation: "fade",
                    contentStyle: { backgroundColor: "transparent" },
                  }
                : {
                    presentation: "card",
                    animation: "slide_from_right",
                  }
            }
          />
        </Stack>
      </RootWebShell>
    </View>
  );
}

function RootLayout() {
  useEffect(() => {
    setSentryBaseTags();
    const globalHandler = (globalThis as unknown as {
      ErrorUtils: {
        setGlobalHandler: (
          handler: (error: unknown, isFatal: boolean) => void
        ) => void;
        getGlobalHandler: () => (error: unknown, isFatal: boolean) => void;
      };
    }).ErrorUtils;
    let lastError = "";
    if (globalHandler.setGlobalHandler) {
      const previous = globalHandler.getGlobalHandler?.();
      globalHandler.setGlobalHandler((error, isFatal) => {
        const message =
          error instanceof Error ? error.message : String(error ?? "Erro desconhecido");
        const stack =
          error instanceof Error && error.stack ? error.stack : undefined;
        const body = stack
           ? `${message}\n\nStack:\n${stack}`.slice(0, 2000)
          : message;
        const key = message + "_" + String(isFatal ?? false);
        if (key !== lastError) {
          lastError = key;
          Sentry.captureException(error instanceof Error ? error : new Error(body), {
            level: isFatal ? "fatal" : "error",
          });
        }
        if (previous) {
          previous(error, isFatal);
        }
      });
    }

    ensureNotificationHandlerConfigured();
    void ensureAndroidNotificationChannel();
  }, []);

  return (
    <>
      <VercelWebAnalytics />
      <AppThemeProvider>
        <Sentry.ErrorBoundary
          fallback={({ error, resetError }) => (
            <RootErrorFallback error={error} resetError={resetError} />
          )}
          showDialog={false}
        >
          <BootstrapProvider>
            <BootstrapAuthProviders />
          </BootstrapProvider>
        </Sentry.ErrorBoundary>
      </AppThemeProvider>
    </>
  );
}

export default RootLayout;

function BootstrapAuthProviders() {
  const { data } = useBootstrap();
  return (
    <AuthProvider initialSession={data?.session ?? null}>
      <BiometricAuthBoundary />
    </AuthProvider>
  );
}

function PedagogicalConfigBoundary({ children }: { children: React.ReactNode }) {
  const { data: bootstrapData } = useBootstrap();
  const pedagogicalConfig = bootstrapData?.pedagogicalConfig ?? null;
  const isLoading = !bootstrapData;
  const error = null;

  return (
    <PedagogicalConfigProvider
      value={{
        config: pedagogicalConfig,
        isLoading,
        error,
      }}
    >
      {children}
    </PedagogicalConfigProvider>
  );
}

function BiometricAuthBoundary() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  return (
    <BiometricLockProvider
      sessionActive={Boolean(session)}
      onForceRelogin={async () => {
        await signOut();
        router.replace("/welcome");
      }}
    >
      <PedagogicalConfigBoundary>
        <RoleProvider>
          <OrganizationProvider>
          <WhatsAppSettingsProvider>
            <ConfirmDialogProvider>
              <ConfirmUndoProvider>
                <SaveToastProvider>
                  <GuidanceProvider>
                    <CopilotProvider>
                      <RootLayoutContent />
                    </CopilotProvider>
                  </GuidanceProvider>
                </SaveToastProvider>
              </ConfirmUndoProvider>
            </ConfirmDialogProvider>
          </WhatsAppSettingsProvider>
          </OrganizationProvider>
        </RoleProvider>
      </PedagogicalConfigBoundary>
    </BiometricLockProvider>
  );
}
