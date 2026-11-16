import { usePathname, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRenderDiagnostic } from "../../dev/useRenderDiagnostic";
import { navigateToPrimaryRoute } from "../../navigation/primary-route-navigation";
import { useOptionalOrganization } from "../../providers/organization-context";
import {
  getTrainerPermissionKey,
  isTrainerPathAllowed,
} from "../../auth/route-permissions";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";
import { compactUiMetrics, radius, shadow } from "../../theme/tokens";
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
  const { usesWorkspaceShell, contentWidth } = useResponsiveLayout();
  const router = useRouter();
  const pathname = usePathname();
  useRenderDiagnostic("AnimatedBottomTabs", { role, pathname, "colors.background": colors.background });
  const [menuOpen, setMenuOpen] = useState(false);
  const [barHeight, setBarHeight] = useState<number>(compactUiMetrics.navigation.height);
  const iconAnim = useSharedValue(0);
  const hideNavigation =
    /\/(assistant)(\/|$)/.test(pathname) ||
    /^\/(prof|coord)\/students(\/|$)/.test(pathname) ||
    /^\/students(\/|$)/.test(pathname) ||
    /^\/(prof|coord)\/periodization(\/|$)/.test(pathname) ||
    /^\/periodization(\/|$)/.test(pathname);
  const hideForWorkspaceShell = usesWorkspaceShell;
  const quickActionsOpen = menuOpen && !hideNavigation && !hideForWorkspaceShell;
  const quickActionsId = useId();
  const quickActionsRef = useRef<View>(null);
  const restoreQuickFocus = useRef(false);
  const isWeb = Platform.OS === "web";

  const tabs = useMemo(() => {
    const baseTabs = ROLE_TABS[role];
    const displayTabs = baseTabs;
    const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;
    if (isOrgAdmin) return displayTabs;

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

    return displayTabs.filter((tab) => {
      if (tab.isCenter) return true;
      const permissionKey = permissionByRoute[tab.routeName];
      if (!permissionKey) return true;
      return memberPermissions[permissionKey] === true;
    });
  }, [activeOrganization?.role_level, memberPermissions, role]);
  const radialActions = useMemo(() => {
    const actions = ROLE_RADIAL_ACTIONS[role];
    const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;
    if (role === "student" || role === "family" || isOrgAdmin) return actions;

    return actions.filter((action) => {
      if (permissionsLoading && getTrainerPermissionKey(String(action.href))) return false;
      return isTrainerPathAllowed(String(action.href), memberPermissions, false);
    });
  }, [activeOrganization?.role_level, memberPermissions, permissionsLoading, role]);
  const bottom = Math.max(insets.bottom + 8, 14);
  const barWidth = Math.min(contentWidth, compactUiMetrics.navigation.maxWidth);

  const closeQuickActions = useCallback(() => {
    restoreQuickFocus.current = true;
    setMenuOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (quickActionsOpen || !restoreQuickFocus.current) return;
    restoreQuickFocus.current = false;
    if (!isWeb) return;
    const menu = quickActionsRef.current as unknown as HTMLElement | null;
    menu?.querySelector<HTMLElement>("[data-goatleta-quick-trigger]")?.focus({ preventScroll: true });
  }, [isWeb, quickActionsOpen]);

  useLayoutEffect(() => {
    if (!isWeb || !quickActionsOpen || typeof document === "undefined") return;
    const menu = quickActionsRef.current as unknown as HTMLElement | null;
    if (!menu) return;
    const controls = () => Array.from(menu.querySelectorAll<HTMLElement>(
      "[data-goatleta-quick-action], [data-goatleta-quick-trigger]",
    ));
    controls()[0]?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeQuickActions();
        return;
      }
      if (event.key !== "Tab") return;

      const buttons = controls();
      const index = buttons.findIndex(button => button === document.activeElement);
      if (index >= 0 && (event.shiftKey ? index > 0 : index < buttons.length - 1)) return;
      event.preventDefault();
      (event.shiftKey ? buttons.at(-1) : buttons[0])?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeQuickActions, isWeb, quickActionsOpen]);

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
    <>
    {isWeb ? <style>{`
      [data-goatleta-quick-action]:focus-visible {
        outline: 2px solid ${colors.text};
        outline-offset: -3px;
      }
      [data-goatleta-quick-trigger]:focus-visible {
        outline: 2px solid ${colors.primaryText};
        outline-offset: -3px;
      }
    `}</style> : null}
    <View
      pointerEvents="none"
      style={{ height: barHeight + bottom + 12, flexShrink: 0, backgroundColor: colors.background }}
    />
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
        aria-hidden={isWeb || !menuOpen}
        accessibilityElementsHidden={isWeb || !menuOpen}
        importantForAccessibility={isWeb || !menuOpen ? "no-hide-descendants" : "auto"}
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
          focusable={!isWeb && menuOpen}
          tabIndex={isWeb ? -1 : undefined}
          onPress={closeQuickActions}
          suppressWebHoverFeedback
          disableWebPressScale
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* 2. Barra inferior e FAB posicionados na base (acima do backdrop) */}
      <View
        ref={quickActionsRef}
        nativeID={quickActionsId}
        accessibilityLabel={menuOpen ? "Ações rápidas" : "Navegação inferior"}
        accessibilityViewIsModal={menuOpen}
        {...(isWeb ? { role: menuOpen ? "dialog" : "navigation", "aria-modal": menuOpen || undefined } as const : {})}
        onLayout={({ nativeEvent }) => {
          const height = Math.ceil(nativeEvent.layout.height);
          if (height > 0) setBarHeight((current) => current === height ? current : height);
        }}
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: "50%",
          marginLeft: -barWidth / 2,
          width: barWidth,
          bottom,
          zIndex: 10,
        }}
      >
        <FabRadialMenu
          visible={menuOpen}
          compact={role === "student"}
          actions={radialActions}
          anchorBottom={52}
          onActionPress={(action) => {
            closeQuickActions();
            navigateToPrimaryRoute({ router, href: action.href });
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            minHeight: compactUiMetrics.navigation.height,
            paddingVertical: compactUiMetrics.smallGap,
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
                accessibilityRole="button"
                accessibilityLabel={menuOpen ? "Fechar ações rápidas" : "Abrir ações rápidas"}
                accessibilityState={{ expanded: menuOpen }}
                {...(isWeb ? {
                  "aria-haspopup": "dialog",
                  "aria-controls": quickActionsId,
                  dataSet: { goatletaQuickTrigger: "true" },
                } : {})}
                onPress={menuOpen ? closeQuickActions : () => setMenuOpen(true)}
                style={{
                  width: compactUiMetrics.navigation.actionSize,
                  height: compactUiMetrics.navigation.actionSize,
                  borderRadius: radius.full,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  zIndex: 4300,
                }}
              >
                <Animated.View style={plusIconStyle}>
                  <GoAtletaIcon name="add" size={20} color={colors.primaryText} />
                </Animated.View>
              </Pressable>
            );
          }

          return (
            <View
              key={tab.key}
              aria-hidden={menuOpen}
              accessibilityElementsHidden={menuOpen}
              importantForAccessibility={menuOpen ? "no-hide-descendants" : "auto"}
              {...(isWeb ? { inert: menuOpen } : {})}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                minWidth: 0,
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
                  width: "100%",
                  minWidth: compactUiMetrics.touchTarget,
                  minHeight: compactUiMetrics.touchTarget,
                  paddingVertical: 3,
                  paddingHorizontal: 2,
                  gap: 2,
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                {({ hovered, focused: keyboardFocused, pressed }: any) => (
                  <>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
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
                          { translateY: hovered ? -1 : 0 },
                          { scale: pressed ? 0.94 : 1 },
                        ],
                      }}
                    >
                      <GoAtletaIcon
                        name={tab.icon}
                        size={compactUiMetrics.navigation.iconSize}
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
                      numberOfLines={1}
                      style={{
                        maxWidth: "100%",
                        fontSize: compactUiMetrics.navigation.labelFontSize,
                        lineHeight: 12,
                        textAlign: "center",
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
  </>
  );
});
