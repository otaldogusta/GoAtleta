import { usePathname } from "expo-router";
import type { ReactNode } from "react";
import { Platform, View, useWindowDimensions } from "react-native";

import type { AppRole } from "../components/navigation/tab-config";
import { WebSidebar } from "./WebSidebar";
import { useAppTheme } from "./app-theme";

type AppShellProps = {
  role: AppRole;
  children: ReactNode;
};

export const WEB_SHELL_MIN_WIDTH = 1200;

export const shouldHideWebShellForPath = (pathname: string) =>
  /\/(assistant)(\/|$)/.test(pathname) ||
  /^\/(prof|coord)\/students(\/|$)/.test(pathname) ||
  /^\/students(\/|$)/.test(pathname) ||
  /^\/(prof|coord)\/planning(\/|$)/.test(pathname) ||
  /^\/(prof|coord)\/periodization(\/|$)/.test(pathname) ||
  /^\/periodization(\/|$)/.test(pathname);

export function AppShell({ role, children }: AppShellProps) {
  const { colors } = useAppTheme();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const useWebShell =
    Platform.OS === "web" &&
    width >= WEB_SHELL_MIN_WIDTH &&
    !shouldHideWebShellForPath(pathname);

  if (!useWebShell) {
    return <>{children}</>;
  }

  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        backgroundColor: colors.background,
        minHeight: "100%",
      }}
    >
      <WebSidebar role={role} />
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}
