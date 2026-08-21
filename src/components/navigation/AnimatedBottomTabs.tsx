import { usePathname, useRouter } from "expo-router";
import { memo, useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRenderDiagnostic } from "../../dev/useRenderDiagnostic";
import { navigateToPrimaryRoute } from "../../navigation/primary-route-navigation";
import { useOptionalOrganization } from "../../providers/OrganizationProvider";
import {
  getTrainerPermissionKey,
  isTrainerPathAllowed,
} from "../../auth/route-permissions";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";
import { radius, shadow } from "../../theme/tokens";
import { resolveBottomTabPress } from "./bottom-tab-navigation";
import { FabRadialMenu } from "./FabRadialMenu";
import { ROLE_RADIAL_ACTIONS, ROLE_TABS, type AppRole } from "./tab-config";

type AnimatedBottomTabsProps = {
  role: AppRole;
  navigation: {
    addListener?: (eventName: string, listener: () => void) => () => void;
    navigate: (routeName: string) => void;
  };
};

export const AnimatedBottomTabs = memo(function AnimatedBottomTabs({
  role,
  navigation,
}: AnimatedBottomTabsProps) {
  const { colors } = useAppTheme();
  const organization = useOptionalOrganization();
  const activeOrganization = organization?.activeOrganization ?? null;
  const memberPermissions = useMemo(
    () => organization?.memberPermissions ?? {},
    [organization]
  );
  const permissionsLoading = organization?.permissionsLoading ?? true;
  const insets = useSafeAreaInsets();
  const { usesWorkspaceShell } = useResponsiveLayout();
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
  const hideForWorkspaceShell = usesWorkspaceShell;

  const tabs = useMemo(() => {
    const baseTabs = ROLE_TABS[role];
    const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;
    if (isOrgAdmin) return baseTabs;

    const permissionByRoute: Partial<Record<string, keyof typeof memberPermissions>> =
      role === "prof"
          ? {
            classes: "classes",
            planning: "training",
          }
        : role === "coord"
          ? {
              classes: "classes",
              planning: "training",
              management: "org_members",
            }
          : {};

    return baseTabs.filter((tab) => {
      if (tab.isCenter) return true;
      const permissionKey = permissionByRoute[tab.routeName];
      if (!permissionKey) return true;
      return memberPermissions[permissionKey] === true;
    });
  }, [activeOrganization?.role_level, memberPermissions, role]);
  const radialActions = useMemo(() => {
    const actions = ROLE_RADIAL_ACTIONS[role];
    const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;
    if (role === "student" || isOrgAdmin) return actions;

    return actions.filter((action) => {
      if (permissionsLoading && getTrainerPermissionKey(String(action.href))) return false;
      return isTrainerPathAllowed(String(action.href), memberPermissions, false);
    });
  }, [activeOrganization?.role_level, memberPermissions, permissionsLoading, role]);
  const bottom = Math.max(insets.bottom + 8, 14);

  useEffect(() => {
    iconAnim.value = withTiming(menuOpen ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [iconAnim, menuOpen]);

  useEffect(() => {
    const unsubscribe = navigation.addListener?.("blur", () => {
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

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: iconAnim.value,
  }));

  if (hideNavigation || hideForWorkspaceShell) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        Platform.OS === "web"
          ? ({
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9000,
            } as any)
          : {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              top: -1000,
              zIndex: 9000,
            },
      ]}
    >
      {/* 1. Backdrop escurecido cobrindo a tela toda */}
      <Animated.View
        pointerEvents={menuOpen ? "auto" : "none"}
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "rgba(10, 19, 34, 0.60)",
            zIndex: 1,
            ...(Platform.OS === "web"
              ? {
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                }
              : null),
          },
          backdropAnimatedStyle,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar menu rápido"
          onPress={() => setMenuOpen(false)}
          suppressWebHoverFeedback
          disableWebPressScale
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* 2. Barra inferior e FAB posicionados na base (acima do backdrop) */}
      <View
        accessibilityLabel="Navegação inferior"
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom,
          zIndex: 10,
        }}
      >
        <FabRadialMenu
          visible={menuOpen}
          actions={radialActions}
          anchorBottom={52}
          onActionPress={(action) => {
            setMenuOpen(false);
            navigateToPrimaryRoute({ router, href: action.href });
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingVertical: 6,
            paddingHorizontal: 8,
            zIndex: 20,
            ...(Platform.OS === "web"
              ? { boxShadow: "0px 8px 18px rgba(10, 19, 34, 0.10)" }
              : shadow.elevated),
          }}
        >
        {tabs.map((tab) => {
          const focused = !tab.isCenter && focusedRouteName === tab.routeName;
          if (tab.isCenter) {
            return (
              <Pressable
                key={tab.key}
                accessibilityLabel={menuOpen ? "Fechar ações rápidas" : "Abrir ações rápidas"}
                onPress={() => setMenuOpen((current) => !current)}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: radius.full,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginTop: -20,
                  zIndex: 4300,
                }}
              >
                <Animated.View style={plusIconStyle}>
                  <GoAtletaIcon name="add" size={24} color={colors.primaryText} />
                </Animated.View>
              </Pressable>
            );
          }

          return (
            <View
              key={tab.key}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 4,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: focused }}
                hitSlop={Platform.OS === "web" ? undefined : 6}
                suppressWebHoverFeedback
                disableWebPressScale
                onPress={() => {
                  setMenuOpen(false);
                  const action = resolveBottomTabPress({
                    focused,
                    href: tab.href,
                    isWeb: Platform.OS === "web",
                    routeName: tab.routeName,
                  });

                  if (action.type === "push") {
                    navigateToPrimaryRoute({ router, href: action.href });
                    return;
                  }

                  if (action.type === "navigate") {
                    navigation.navigate(action.routeName);
                  }
                }}
                style={({ pressed }: any) => ({
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 2,
                  paddingHorizontal: 2,
                  gap: 2,
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                {({ hovered, focused: keyboardFocused, pressed }: any) => (
                  <>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: focused
                          ? colors.primaryBg
                          : hovered || keyboardFocused
                            ? colors.successBg
                            : "transparent",
                        borderWidth: keyboardFocused ? 2 : 0,
                        borderColor: focused ? colors.primaryText : colors.primaryBg,
                        transform: [
                          { translateY: focused ? -3 : hovered ? -1 : 0 },
                          { scale: pressed ? 0.94 : 1 },
                        ],
                      }}
                    >
                      <GoAtletaIcon
                        name={tab.icon}
                        size={18}
                        color={
                          focused
                            ? colors.primaryText
                            : hovered || keyboardFocused
                              ? colors.success
                              : colors.muted
                        }
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: focused || hovered || keyboardFocused ? "700" : "600",
                        color: focused || hovered || keyboardFocused ? colors.text : colors.muted,
                      }}
                    >
                      {tab.label}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  </View>
  );
});
