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
  Platform,
  Text,
  View
} from "react-native";
import { Pressable } from "../src/ui/Pressable";

import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuth } from "../src/auth/auth";
import { RoleProvider, useRole } from "../src/auth/role";
import { BootstrapGate } from "../src/bootstrap/BootstrapGate";
import { BootstrapProvider, useBootstrap } from "../src/bootstrap/BootstrapProvider";
import { addNotification } from "../src/notificationsInbox";
import { logNavigation } from "../src/observability/breadcrumbs";
import { setSentryBaseTags } from "../src/observability/sentry";
import { AppThemeProvider, useAppTheme } from "../src/ui/app-theme";
import { ConfirmDialogProvider } from "../src/ui/confirm-dialog";
import { ConfirmUndoProvider } from "../src/ui/confirm-undo";
import { GuidanceProvider } from "../src/ui/guidance";
import { SaveToastProvider } from "../src/ui/save-toast";
import { WhatsAppSettingsProvider } from "../src/ui/whatsapp-settings-context";

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
  const rootState = useRootNavigationState();
  const { session, loading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const navReady = Boolean(rootState?.key);
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
    "/profile",
    "/student-plan",
    "/student-home",
  ];
  const trainerOnlyPrefixes = [
    "/absence-notices",
    "/assistant",
    "/calendar",
    "/class",
    "/classes",
    "/exercises",
    "/periodization",
    "/reports",
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
    if (!pathname) return;
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    logNavigation(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!navReady) return;
    if (loading) return;
    if (roleLoading) return;
    if (session && role === null) return;
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
    if (session && ["/welcome", "/login", "/signup"].includes(pathname)) {
      router.replace("/");
    }
  }, [isInviteRoute, isPublicRoute, loading, navReady, pathname, router, role, roleLoading, session]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const type = params.get("type");
    const accessToken = params.get("access_token");
    if (type === "recovery" && accessToken) {
      const next = `/reset-password?access_token=${encodeURIComponent(accessToken)}`;
      window.location.replace(next);
    }
  }, []);

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
textarea:-webkit-autofill,
textarea:-webkit-autofill:hover,
textarea:-webkit-autofill:focus,
textarea:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 1000px ${colors.inputBg} inset;
  box-shadow: 0 0 0 1000px ${colors.inputBg} inset;
  -webkit-text-fill-color: ${colors.inputText};
  caret-color: ${colors.inputText};
}
`;
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }, [colors.inputBg, colors.inputText]);

  return (
    <>
      <StatusBar
        style={mode === "dark" ? "light" : "dark"}
        backgroundColor={colors.card}
      />
      {Platform.OS === "web" && canGoBack ? (
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
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      >
      </Stack>
      {loading || roleLoading ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colors.background,
          }}
        />
      ) : null}
    </>
  );
}

export default Sentry.wrap(function RootLayout() {
  useEffect(() => {
    setSentryBaseTags();
    const globalHandler = (global as {
      ErrorUtils?: {
        setGlobalHandler?: (
          handler: (error: unknown, isFatal?: boolean) => void
        ) => void;
        getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
      };
    }).ErrorUtils;
    let lastError = "";
    if (globalHandler?.setGlobalHandler) {
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
    <AppThemeProvider>
      <BootstrapProvider>
        <BootstrapGate>
          <BootstrapAuthProviders />
        </BootstrapGate>
      </BootstrapProvider>
    </AppThemeProvider>
  );
});

function BootstrapAuthProviders() {
  const { data } = useBootstrap();
  return (
    <AuthProvider initialSession={data?.session ?? null}>
      <RoleProvider>
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
      </RoleProvider>
    </AuthProvider>
  );
}
