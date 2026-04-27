import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Text, View, useWindowDimensions } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRenderDiagnostic } from "../../dev/useRenderDiagnostic";
import { useOptionalOrganization } from "../../providers/OrganizationProvider";
import { Pressable } from "../../ui/Pressable";
import { WEB_SHELL_MIN_WIDTH, shouldHideWebShellForPath } from "../../ui/AppShell";
import { useAppTheme } from "../../ui/app-theme";
import { FabRadialMenu } from "./FabRadialMenu";
import { ROLE_RADIAL_ACTIONS, ROLE_TABS, type AppRole } from "./tab-config";

type AnimatedBottomTabsProps = BottomTabBarProps & {
  role: AppRole;
};

export function AnimatedBottomTabs({
  role,
  navigation,
}: AnimatedBottomTabsProps) {
  const { colors } = useAppTheme();
  const organization = useOptionalOrganization();
  const activeOrganization = organization?.activeOrganization ?? null;
  const memberPermissions = organization?.memberPermissions ?? {};
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  useRenderDiagnostic("AnimatedBottomTabs", { role, pathname, "colors.background": colors.background });
  const [menuOpen, setMenuOpen] = useState(false);
  const iconAnim = useSharedValue(0);
  const hideNavigation =
    /\/(assistant)(\/|$)/.test(pathname) ||
    /^\/(prof|coord)\/students(\/|$)/.test(pathname) ||
    /^\/students(\/|$)/.test(pathname) ||
    /^\/(prof|coord)\/planning(\/|$)/.test(pathname) ||
    /^\/(prof|coord)\/periodization(\/|$)/.test(pathname) ||
    /^\/periodization(\/|$)/.test(pathname);
  const hideForWebShell =
    role === "prof" &&
    Platform.OS === "web" &&
    width >= WEB_SHELL_MIN_WIDTH &&
    !shouldHideWebShellForPath(pathname);

  const tabs = useMemo(() => {
    const baseTabs = ROLE_TABS[role];
    const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;
    if (isOrgAdmin) return baseTabs;

    const permissionByRoute: Partial<Record<string, keyof typeof memberPermissions>> =
      role === "prof"
        ? {
            classes: "classes",
            planning: "training",
            reports: "reports",
          }
        : role === "coord"
          ? {
              classes: "classes",
              reports: "reports",
              management: "org_members",
            }
          : {};

    return baseTabs.filter((tab) => {
      if (tab.isCenter) return true;
      const permissionKey = permissionByRoute[tab.routeName];
      if (!permissionKey) return true;
      return memberPermissions[permissionKey] !== false;
    });
  }, [activeOrganization?.role_level, memberPermissions, role]);
  const radialActions = ROLE_RADIAL_ACTIONS[role];
  const bottom = Math.max(insets.bottom + 8, 14);

  useEffect(() => {
    iconAnim.value = withTiming(menuOpen ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [iconAnim, menuOpen]);

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener("blur", () => {
      setMenuOpen(false);
    });
    return unsubscribe;
  }, [navigation]);

  const plusIconStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${iconAnim.value * 45}deg` },
      { scale: 1 + iconAnim.value * 0.06 },
    ],
  }));

  // Usa pathname para determinar o tab focado — mais confiável no web
  // onde state.routes pode não conter rotas não visitadas.
  const focusedRouteName = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
  }, [pathname]);

  if (hideNavigation || hideForWebShell) {
    return null;
  }

  return (
    <View
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom,
        zIndex: 3000,
        pointerEvents: "box-none",
      }}
    >
      <FabRadialMenu
        visible={menuOpen}
        actions={radialActions}
        anchorBottom={48}
        onActionPress={(action) => {
          setMenuOpen(false);
          router.push(action.href);
        }}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          paddingVertical: 6,
          paddingHorizontal: 8,
          ...(Platform.OS === "web"
            ? { boxShadow: "0px 8px 14px rgba(0, 0, 0, 0.16)" }
            : {
                shadowColor: "#000",
                shadowOpacity: 0.16,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 8 },
              }),
          elevation: 14,
        }}
      >
        {tabs.map((tab) => {
          const focused = !tab.isCenter && focusedRouteName === tab.routeName;
          if (tab.isCenter) {
            return (
              <Pressable
                key={tab.key}
                onPress={() => setMenuOpen((current) => !current)}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginTop: -20,
                }}
              >
                <Animated.View style={plusIconStyle}>
                  <Ionicons name="add" size={24} color={colors.primaryText} />
                </Animated.View>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate(tab.routeName as never);
              }}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 6,
                gap: 2,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: focused ? colors.primaryBg : "transparent",
                  transform: [{ translateY: focused ? -3 : 0 }],
                }}
              >
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={focused ? colors.primaryText : colors.muted}
                />
              </View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: focused ? "700" : "600",
                  color: focused ? colors.text : colors.muted,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
