import type { ReactNode } from "react";
import { Platform, View } from "react-native";

import type { AppRole } from "../components/navigation/tab-config";
import { AdaptiveSidebar } from "./AdaptiveSidebar";
import { useAppTheme } from "./app-theme";
import { useResponsiveLayout } from "./use-responsive-layout";

type AppShellProps = {
  role: AppRole;
  children: ReactNode;
};

export function AppShell({ role, children }: AppShellProps) {
  const layout = useResponsiveLayout("dashboard");
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        {
          flex: 1,
          flexDirection: "row",
          backgroundColor: colors.background,
          minHeight: 0,
        },
        Platform.OS === "web"
          ? ({ height: "100vh", maxHeight: "100vh", overflow: "hidden" } as any)
          : null,
      ]}
    >
      <AdaptiveSidebar role={role} canExpand={layout.canExpandSidebar} />
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
