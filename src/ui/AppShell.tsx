import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Animated, BackHandler, Easing, Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AppRole } from "../components/navigation/tab-config";
import { AdaptiveSidebar } from "./AdaptiveSidebar";
import { useAppTheme } from "./app-theme";
import { NativeSidebar, NATIVE_SIDEBAR_EXPANDED_WIDTH } from "./NativeSidebar";
import {
  NativeSidebarControllerContext,
  type NativeSidebarController,
} from "./native-sidebar-controller";
import { useResponsiveLayout } from "./use-responsive-layout";

type AppShellProps = {
  role: AppRole;
  children: ReactNode;
};

export function AppShell({ role, children }: AppShellProps) {
  const layout = useResponsiveLayout("dashboard");
  const { colors } = useAppTheme();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSidebarProgress] = useState(() => new Animated.Value(0));
  const isNativeMobile = Platform.OS !== "web" && !layout.usesWorkspaceShell;
  if (!isNativeMobile && mobileSidebarOpen) setMobileSidebarOpen(false);
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const sidebarController = useMemo<NativeSidebarController>(
    () => ({ openMobileSidebar, closeMobileSidebar }),
    [closeMobileSidebar, openMobileSidebar]
  );

  useEffect(() => {
    if (!isNativeMobile || !mobileSidebarOpen) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeMobileSidebar();
      return true;
    });
    return () => subscription.remove();
  }, [closeMobileSidebar, isNativeMobile, mobileSidebarOpen]);

  useEffect(() => {
    if (!isNativeMobile) {
      mobileSidebarProgress.setValue(0);
      return undefined;
    }

    const animation = Animated.timing(mobileSidebarProgress, {
      toValue: mobileSidebarOpen ? 1 : 0,
      duration: mobileSidebarOpen ? 220 : 170,
      easing: mobileSidebarOpen
        ? Easing.out(Easing.cubic)
        : Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [isNativeMobile, mobileSidebarOpen, mobileSidebarProgress]);

  const mobileSidebarTranslateX = mobileSidebarProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-NATIVE_SIDEBAR_EXPANDED_WIDTH, 0],
  });

  return (
    <NativeSidebarControllerContext.Provider value={sidebarController}>
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
        <AdaptiveSidebar
          role={role}
          showCompact={layout.usesWorkspaceShell}
          canExpand={layout.canExpandSidebar}
          canPersistExpansion={layout.canPersistExpandedSidebar}
        />
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
        {isNativeMobile ? (
          <View
            accessibilityViewIsModal
            accessibilityElementsHidden={!mobileSidebarOpen}
            importantForAccessibility={mobileSidebarOpen ? "yes" : "no-hide-descendants"}
            pointerEvents={mobileSidebarOpen ? "auto" : "none"}
            style={[StyleSheet.absoluteFill, { zIndex: 5000, elevation: 40, flexDirection: "row" }]}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "rgba(2, 8, 23, 0.58)", opacity: mobileSidebarProgress },
              ]}
            >
              <Pressable
                accessibilityLabel="Fechar menu principal"
                onPress={closeMobileSidebar}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Animated.View
              renderToHardwareTextureAndroid
              style={{
                width: NATIVE_SIDEBAR_EXPANDED_WIDTH,
                height: "100%",
                transform: [{ translateX: mobileSidebarTranslateX }],
              }}
            >
              <SafeAreaView
                style={{
                  width: NATIVE_SIDEBAR_EXPANDED_WIDTH,
                  height: "100%",
                  backgroundColor: colors.background,
                }}
              >
                <NativeSidebar
                  role={role}
                  visible
                  drawerOpen={mobileSidebarOpen}
                  canExpand={false}
                  forceExpanded
                  onNavigate={closeMobileSidebar}
                  onRequestClose={closeMobileSidebar}
                />
              </SafeAreaView>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </NativeSidebarControllerContext.Provider>
  );
}
