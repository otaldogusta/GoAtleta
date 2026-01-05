import {
  useEffect } from "react";
import { Platform,
  Text,
  View
} from "react-native";
import { Pressable } from "../src/ui/Pressable";
import {
  Stack,
  usePathname,
  useRouter,
  useRootNavigationState,
} from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";

import { initDb } from "../src/db/sqlite";
import { AppThemeProvider } from "../src/ui/app-theme";
import { useAppTheme } from "../src/ui/app-theme";
import { ConfirmUndoProvider } from "../src/ui/confirm-undo";
import { ConfirmDialogProvider } from "../src/ui/confirm-dialog";
import { SaveToastProvider } from "../src/ui/save-toast";
import { addNotification } from "../src/notificationsInbox";
import { AuthProvider, useAuth } from "../src/auth/auth";
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://75f40b427f0cc0089243e3a498ab654f@o4510656157777920.ingest.us.sentry.io/4510656167608320',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

function RootLayoutContent() {
  const { colors, mode } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const rootState = useRootNavigationState();
  const { session, loading } = useAuth();
  const navReady = Boolean(rootState?.key);
  const publicRoutes = ["/welcome", "/login", "/signup", "/reset-password"];
  const canGoBack =
    Platform.OS === "web" &&
    pathname !== "/" &&
    !publicRoutes.includes(pathname);

  useEffect(() => {
    if (!navReady) return;
    if (loading) return;
    const timer = setTimeout(() => {
      if (!session && !publicRoutes.includes(pathname)) {
        router.replace("/welcome");
        return;
      }
      if (session && ["/welcome", "/login", "/signup"].includes(pathname)) {
        router.replace("/");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [loading, navReady, pathname, router, session]);

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
      {loading ? (
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
    initDb();
  }, []);

  return (
    <AppThemeProvider>
      <AuthProvider>
        <ConfirmDialogProvider>
          <ConfirmUndoProvider>
            <SaveToastProvider>
              <RootLayoutContent />
            </SaveToastProvider>
          </ConfirmUndoProvider>
        </ConfirmDialogProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
});