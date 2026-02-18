import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import {
    Stack,
    usePathname,
    useRootNavigationState,
    useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
    useEffect,
    useRef
} from "react";
import {
    ActivityIndicator,
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
import { BootstrapProvider, useBootstrap } from "../src/bootstrap/BootstrapProvider";
import { addNotification } from "../src/notificationsInbox";
import { logNavigation } from "../src/observability/breadcrumbs";
import { setSentryBaseTags } from "../src/observability/sentry";
import { OrganizationProvider, useOrganization } from "../src/providers/OrganizationProvider";
import { BiometricLockProvider, useBiometricLock } from "../src/security/biometric-lock";
import { AppThemeProvider, useAppTheme } from "../src/ui/app-theme";
import { ConfirmDialogProvider } from "../src/ui/confirm-dialog";
import { ConfirmUndoProvider } from "../src/ui/confirm-undo";
import { GuidanceProvider } from "../src/ui/guidance";
import { SaveToastProvider } from "../src/ui/save-toast";
import { WhatsAppSettingsProvider } from "../src/ui/whatsapp-settings-context";

const trainerPermissionByPrefix = [
  { prefix: "/coordination", permissionKey: "org_members" },
  { prefix: "/evidence", permissionKey: "assistant" },
  { prefix: "/reports", permissionKey: "reports" },
  { prefix: "/events", permissionKey: "events" },
  { prefix: "/students", permissionKey: "students" },
  { prefix: "/class", permissionKey: "classes" },
  { prefix: "/classes", permissionKey: "classes" },
  { prefix: "/training", permissionKey: "training" },
  { prefix: "/periodization", permissionKey: "periodization" },
  { prefix: "/calendar", permissionKey: "calendar" },
  { prefix: "/absence-notices", permissionKey: "absence_notices" },
  { prefix: "/whatsapp-settings", permissionKey: "whatsapp_settings" },
  { prefix: "/assistant", permissionKey: "assistant" },
  { prefix: "/org-members", permissionKey: "org_members" },
  { prefix: "/nfc-attendance", permissionKey: "classes" },
] as const;

const enableSentryPii = __DEV__;
const enableSentryLogs = __DEV__;

Sentry.init({
  dsn: 'https://75f40b427f0cc0089243e3a498ab654f@o4510656157777920.ingest.us.sentry.io/4510656167608320',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: enableSentryPii,

  // Enable Logs
  enableLogs: enableSentryLogs,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

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
  const { memberPermissions, permissionsLoading, isLoading: organizationLoading } =
    useOrganization();
  const { isEnabled: biometricsEnabled, isUnlocked } = useBiometricLock();
  const hadSessionRef = useRef(false);
  const navReady = Boolean(rootState.key);
  const isBooting =
    bootstrapLoading ||
    !navReady ||
    loading ||
    roleLoading ||
    (session && role === "trainer" && organizationLoading) ||
    (session && role === null);
  const publicRoutes = [
    "/welcome",
    "/login",
    "/signup",
    "/reset-password",
    ...(__DEV__ ? ["/admin"] : []),
  ];
  const publicPrefixes = ["/invite"];
  const studentOnlyRoutes = [
    "/absence-report",
    "/communications",
    "/student-plan",
    "/student-home",
  ];
  const trainerOnlyPrefixes = [
    "/coordination",
    "/evidence",
    "/absence-notices",
    "/assistant",
    "/calendar",
    "/class",
    "/classes",
    "/events",
    "/exercises",
    "/periodization",
    "/reports",
    "/org-members",
    "/nfc-attendance",
    "/students",
    "/training",
    "/whatsapp-settings",
  ];
  const isInviteRoute = pathname.startsWith("/invite");
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    publicPrefixes.some((prefix) => pathname.startsWith(prefix));
  const canGoBack =
    Platform.OS === "web" &&
    pathname !== "/" &&
    !isPublicRoute;

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

  useEffect(() => {
    const hadSession = hadSessionRef.current;
    const hasSession = Boolean(session);
    hadSessionRef.current = hasSession;
    if (!hadSession && hasSession && pathname.startsWith("/events/")) {
      router.replace("/");
    }
  }, [pathname, router, session]);

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

    if (bootstrapLoading) return;
    if (!navReady) return;
    if (loading) return;
    if (roleLoading) return;
    if (session && role === "trainer" && permissionsLoading) return;
    if (session && role === null) return;
    if (
      session &&
      Platform.OS !== "web" &&
      biometricsEnabled &&
      !isUnlocked &&
      pathname !== "/login" &&
      pathname !== "/reset-password" &&
      !isInviteRoute
    ) {
      router.replace("/login");
      return;
    }
    if (!session && !isPublicRoute) {
      router.replace("/welcome");
      return;
    }
    if (session && role === "pending" && pathname !== "/pending" && !isInviteRoute) {
      router.replace("/pending");
      return;
    }
    if (session && role === "trainer" && pathname === "/pending") {
      router.replace("/");
      return;
    }
    if (session && role === "student" && pathname === "/pending") {
      router.replace("/");
      return;
    }
    if (session && role === "student") {
      const blocked = trainerOnlyPrefixes.some((prefix) =>
        pathname.startsWith(prefix)
      );
      if (blocked) {
        router.replace("/");
        return;
      }
    }
    if (session && role === "trainer" && studentOnlyRoutes.includes(pathname)) {
      router.replace("/");
      return;
    }
    if (session && role === "trainer") {
      const matched = trainerPermissionByPrefix.find((item) =>
        pathname.startsWith(item.prefix)
      );
      if (matched && memberPermissions[matched.permissionKey] === false) {
        router.replace("/");
        return;
      }
    }
    if (session && ["/welcome", "/login", "/signup"].includes(pathname)) {
      if (Platform.OS !== "web" && biometricsEnabled && !isUnlocked) {
        if (pathname !== "/login") {
          router.replace("/login");
        }
        return;
      }
      router.replace("/");
    }
  }, [
    biometricsEnabled,
    isInviteRoute,
    isPublicRoute,
    isUnlocked,
    loading,
    memberPermissions,
    navReady,
    pathname,
    permissionsLoading,
    bootstrapLoading,
    router,
    role,
    roleLoading,
    session,
  ]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined") return;

    // Process OAuth code from query params
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
        console.log("[OAuth] Found code in URL, exchanging for session...");
      const redirectAfterAuth = async () => {
        const pending = await getPendingInvite();
        router.replace(pending ? `/invite/${pending}` : "/");
      };
      exchangeCodeForSession(code).then(async () => {
          console.log("[OAuth] Session exchange successful, redirecting to home");
        // Clean up URL
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        await redirectAfterAuth();
      }).catch((err) => {
        console.error("[OAuth] Failed to exchange code:", err);
        router.replace("/welcome");
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
      const next = `/reset-password?access_token=${encodeURIComponent(accessToken)}`;
      window.location.replace(next);
      return;
    }
    if (accessToken && type !== "recovery") {
      console.log("[Auth] Found access token in URL, saving session...");
      const redirectAfterAuth = async () => {
        const pending = await getPendingInvite();
        router.replace(pending ? `/invite/${pending}` : "/");
      };
      consumeAuthUrl(window.location.href).then(async () => {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
        await redirectAfterAuth();
      }).catch((err) => {
        console.error("[Auth] Failed to consume auth URL:", err);
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
        router.replace("/welcome");
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
    style.textContent = css;
  }, [colors.inputBg, colors.inputText, colors.border, colors.muted]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof document === "undefined") return;
    let timeout: number | null = null;
    const handleScroll = () => {
      document.body.classList.add("app-scrolling");
      document.documentElement.classList.add("app-scrolling");
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        document.body.classList.remove("app-scrolling");
        document.documentElement.classList.remove("app-scrolling");
      }, 1200);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    document.addEventListener("wheel", handleScroll, { passive: true });
    document.addEventListener("touchmove", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll, { capture: true } as AddEventListenerOptions);
      document.removeEventListener("wheel", handleScroll);
      document.removeEventListener("touchmove", handleScroll);
      if (timeout) window.clearTimeout(timeout);
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
      { Platform.OS === "web" && canGoBack ? (
        <View
          style={{
            position: "absolute",
            bottom: 16,
            left: 12,
            zIndex: 10,
          }}
        >
          <Pressable
            onPress={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                window.history.back();
                return;
              }
              router.replace("/");
            }}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Voltar
            </Text>
          </Pressable>
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
          options={{
            presentation: "transparentModal",
            animation: "fade",
            contentStyle: { backgroundColor: "transparent" },
          }}
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

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
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
                    <RootLayoutContent />
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
