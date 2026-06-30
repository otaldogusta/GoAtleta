import { usePathname } from "expo-router";
import type { ReactNode } from "react";
import { Platform, View, useWindowDimensions } from "react-native";

import type { AppRole } from "../components/navigation/tab-config";
import { WebSidebar } from "./WebSidebar";
import { webShellTokens } from "./web-shell-tokens";

type AppShellProps = {
  role: AppRole;
  children: ReactNode;
};

export const WEB_SHELL_MIN_WIDTH = 1200;

export const shouldHideWebShellForPath = (pathname: string) =>
  /\/(assistant)(\/|$)/.test(pathname);

export function AppShell({ role, children }: AppShellProps) {
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
      style={[
        {
          flex: 1,
          flexDirection: "row",
          backgroundColor: webShellTokens.background,
          minHeight: 0,
        },
        {
          height: "100vh",
          maxHeight: "100vh",
          overflow: "hidden",
        } as any,
      ]}
    >
      <WebSidebar role={role} />
      <View
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}
