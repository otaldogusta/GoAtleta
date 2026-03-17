import { LinearGradient } from "expo-linear-gradient";
import {
    Stack,
    usePathname,
    useRootNavigationState,
    useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";
import {
    ActivityIndicator,
    AppState,
    Image,
    LogBox,
    Platform, StyleSheet, Text,
    View
} from "react-native";
import { Pressable } from "../src/ui/Pressable";

import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuth } from "../src/auth/auth";
import { getPendingInvite } from "../src/auth/pending-invite";
import { RoleProvider, useRole } from "../src/auth/role";
import {
    hybridVerificationRestrictedPrefixes,
    studentOnlyRoutes,
    trainerOnlyPrefixes,
    trainerPermissionByPrefix,
} from "../src/auth/route-permissions";
import { BootstrapProvider, useBootstrap } from "../src/bootstrap/BootstrapProvider";
import { CopilotProvider } from "../src/copilot/CopilotProvider";
import { addNotification } from "../src/notificationsInbox";
import { logNavigation } from "../src/observability/breadcrumbs";
import { setSentryBaseTags } from "../src/observability/sentry";
import { OrganizationProvider, useOrganization } from "../src/providers/OrganizationProvider";
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
import { SaveToastProvider } from "../src/ui/save-toast";
import { WhatsAppSettingsProvider } from "../src/ui/whatsapp-settings-context";

const enableSentryPii = __DEV__;
const enableSentryLogs = __DEV__;

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',

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
    // Preserve router-managed history state to avoid breaking React Navigation rehydration.
    const currentState = window.history.state ?? null;
    window.history.replaceState(currentState, "", url);
  } catch {
    // Non-blocking fallback for restrictive browser environments.
  }
}

function RootLayoutContent() {
  const { colors, mode } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);
  const { loading: bootstrapLoading, error: bootstrapError, retry: retryBootstrap } =
    useBootstrap();
  const rootState = useRootNavigationState();
  const { session, loading, exchangeCodeForSession, consumeAuthUrl } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const { activeOrganization, memberPermissions, permissionsLoading } = useOrganization();
  const { isEnabled: biometricsEnabled, isUnlocked, hasCredentialLoginBypass } = useBiometricLock();
  const hadSessionRef = useRef(false);
  const initialRouteGuardAppliedRef = useRef(false);
  const stuckEventsGuardRef = useRef(false);
  const appStartedAtRef = useRef(Date.now());
  const pushRegistrationInFlightRef = useRef(false);
  const lastPushRegistrationKeyRef = useRef("");
  const oauthHandledHrefRef = useRef("");
  const oauthInFlightRef = useRef(false);
  const navReady = Boolean(rootState?.key);
  const isAdminProfile = role === "trainer" && (activeOrganization?.role_level ?? 0) >= 50;
  const isBooting =
    bootstrapLoading ||
    !navReady ||
    loading;
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
    const detach = attachPushListeners(router);
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
      router.replace("/");
    }
  }, [normalizedPathname, router, session]);

  useEffect(() => {
    if (initialRouteGuardAppliedRef.current) return;
    if (bootstrapLoading || !navReady || loading) return;
    initialRouteGuardAppliedRef.current = true;

    // Guard against stale deep-link/navigation state restoring users into /events on app boot.
    if (session && normalizedPathname === "/events") {
      router.replace("/");
    }
  }, [bootstrapLoading, loading, navReady, normalizedPathname, router, session]);

  useEffect(() => {
    if (stuckEventsGuardRef.current) return;
    if (bootstrapLoading || !navReady || loading) return;
    if (normalizedPathname !== "/events") return;

    const routeCount = Array.isArray(rootState?.routes) ? rootState.routes.length : 0;
    const elapsedMs = Date.now() - appStartedAtRef.current;
    if (routeCount <= 1 && elapsedMs < 15_000) {
      stuckEventsGuardRef.current = true;
      router.replace("/");
    }
  }, [bootstrapLoading, loading, navReady, normalizedPathname, rootState?.routes, router]);

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

    if (normalizedPathname === "/onboarding") {
      redirectTo = session ? "/" : "/welcome";
    } else if (session && ["/onboarding", "/welcome", "/login", "/signup"].includes(normalizedPathname)) {
      redirectTo = "/";
    } else if (!session && normalizedPathname === "/") {
      redirectTo = "/welcome";
    } else if (!session && !isPublicRoute) {
      redirectTo = "/login";
    }

    if (redirectTo) {
      if (redirectTo !== normalizedPathname) {
        router.replace(redirectTo);
      }
      return;
    }

    if (roleLoading) return;
    if (session && role === "trainer" && permissionsLoading) return;

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
    if (session && role === "trainer" && normalizedPathname === "/pending") {
      router.replace("/");
      return;
    }
    if (session && role === "student" && normalizedPathname === "/pending") {
      router.replace("/");
      return;
    }
    if (session && role === "student") {
      const blocked = trainerOnlyPrefixes.some((prefix) =>
        normalizedPathname.startsWith(prefix)
      );
      if (blocked) {
        router.replace("/");
        return;
      }
    }
    if (
      session &&
      role === "trainer" &&
      (studentOnlyRoutes.includes(normalizedPathname) ||
        normalizedPathname.startsWith("/student"))
    ) {
      router.replace("/");
      return;
    }
    if (session && role === "trainer" && !isAdminProfile) {
      const matched = trainerPermissionByPrefix.find((item) =>
        normalizedPathname.startsWith(item.prefix)
      );
      if (matched && memberPermissions[matched.permissionKey] === false) {
        router.replace("/");
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
      oauthHandledHrefRef.current = authHref;
      oauthInFlightRef.current = true;
      const redirectAfterAuth = async () => {
        const pending = await getPendingInvite();
        router.replace(pending ? `/invite/${pending}` : "/");
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
      oauthHandledHrefRef.current = authHref;
      oauthInFlightRef.current = true;
      const redirectAfterAuth = async () => {
        const pending = await getPendingInvite();
        router.replace(pending ? `/invite/${pending}` : "/");
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
  scrollbar-width: none;
  scrollbar-color: transparent transparent;
}
*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background-color: rgba(0,0,0,0);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
  transition: background-color 240ms ease, opacity 240ms ease;
  opacity: 0;
}
body.app-scrolling {
  scrollbar-width: thin;
  scrollbar-color: ${colors.border} transparent;
}
body.app-scrolling *::-webkit-scrollbar-thumb {
  background-color: ${colors.border};
  opacity: 1;
}
body.app-scrolling *::-webkit-scrollbar-thumb:hover {
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

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof document === "undefined") return;
    let timeout: number | null = null;
    let rafId: number | null = null;
    let scrollingActive = false;

    const activateScrolling = () => {
      if (!scrollingActive) {
        scrollingActive = true;
        document.body.classList.add("app-scrolling");
        document.documentElement.classList.add("app-scrolling");
      }
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        scrollingActive = false;
        document.body.classList.remove("app-scrolling");
        document.documentElement.classList.remove("app-scrolling");
      }, 450);
    };

    const handleScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        activateScrolling();
      });
    };

    const passiveOpts: AddEventListenerOptions = { passive: true };
    window.addEventListener("scroll", handleScroll, passiveOpts);
    document.addEventListener("wheel", handleScroll, passiveOpts);
    document.addEventListener("touchmove", handleScroll, passiveOpts);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("wheel", handleScroll);
      document.removeEventListener("touchmove", handleScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timeout) window.clearTimeout(timeout);
      if (scrollingActive) {
        document.body.classList.remove("app-scrolling");
        document.documentElement.classList.remove("app-scrolling");
      }
    };
  }, []);

  const noiseUri =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAAAAACMmsGiAAAAFklEQVR4nGNgYGD4z8DAwMDAwAAABv0C/0sV9K8AAAAASUVORK5CYII=";
  const gradientByRoute = () => {
    return mode === "dark"
       ? ["#0b1222", "#101b34", "#121a2a"]
      : ["#f6f8fb", "#e7edf7", "#f2f5fb"];
  };

  const gradientStops = gradientByRoute();

  if (bootstrapError) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0b1222" }}>
        <LinearGradient
          colors={["#0b1222", "#101b34", "#121a2a"]}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 12,
          }}
        >
          <Text style={{ color: "#f8fafc", fontWeight: "700" }}>
            Ocorreu um erro ao iniciar
          </Text>
          <Text style={{ color: "#cbd5e1", textAlign: "center" }}>
            Tente novamente. Se persistir, reinicie o app.
          </Text>
          <Pressable
            onPress={retryBootstrap}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: "rgba(86, 214, 154, 0.28)",
            }}
          >
            <Text style={{ color: "#eafff5", fontWeight: "700" }}>Tentar novamente</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isBooting) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0b1222" }}>
        <LinearGradient
          colors={["#0b1222", "#101b34", "#121a2a"]}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <ActivityIndicator size="large" color="#e5e7eb" />
          <Text style={{ color: "#e5e7eb", fontWeight: "600" }}>Carregando...</Text>
        </View>
        <StatusBar
          style={mode === "dark" ? "light" : "dark"}
          backgroundColor="transparent"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={gradientStops} style={StyleSheet.absoluteFill} />
      { Platform.OS === "web" ? (
        <Image
          source={{ uri: noiseUri }}
          resizeMode="repeat"
          style={[StyleSheet.absoluteFill, { opacity: mode === "dark" ? 0.035 : 0.05 }]}
        />
      ) : null}
      <StatusBar
        style={mode === "dark" ? "light" : "dark"}
        backgroundColor="transparent"
      />
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
          contentStyle: { backgroundColor: "transparent" },
          headerStyle: { backgroundColor: "transparent" },
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
    </View>
  );
}

function RootLayout() {
  useEffect(() => {
    setSentryBaseTags();
    const globalHandler = (global as {
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
          void addNotification(
            isFatal ? "Erro fatal" : "Erro no app",
            body
          );
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
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#1a1a1a',
          padding: 16,
        }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
            Algo deu errado
          </Text>
          <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 24, textAlign: 'center' }}>
            {error?.message || 'Um erro inesperado ocorreu'}
          </Text>
          <Pressable
            onPress={resetError}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 8,
              backgroundColor: '#2563eb',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              Tentar novamente
            </Text>
          </Pressable>
        </View>
      )}
      showDialog
    >
      <AppThemeProvider>
        <BootstrapProvider>
          <BootstrapAuthProviders />
        </BootstrapProvider>
      </AppThemeProvider>
    </Sentry.ErrorBoundary>
  );
}

export default RootLayout;

function BootstrapAuthProviders() {
  const { data } = useBootstrap();
  return (
    <AuthProvider initialSession={data?.session}>
      <BiometricAuthBoundary />
    </AuthProvider>
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
    </BiometricLockProvider>
  );
}
