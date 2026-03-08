import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { FabRadialMenu } from "./FabRadialMenu";
import { ROLE_RADIAL_ACTIONS, ROLE_TABS, type AppRole } from "./tab-config";

type AnimatedBottomTabsProps = BottomTabBarProps & {
  role: AppRole;
};

export function AnimatedBottomTabs({
  role,
  state,
  navigation,
}: AnimatedBottomTabsProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const iconAnim = useSharedValue(0);

  const tabs = ROLE_TABS[role];
  const radialActions = ROLE_RADIAL_ACTIONS[role];
  const focusedIndex = state.index;
  const bottom = Math.max(insets.bottom + 8, 14);

  useEffect(() => {
    iconAnim.value = withTiming(menuOpen ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [iconAnim, menuOpen]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("blur", () => {
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

  const tabRouteNames = useMemo(
    () => state.routes.map((route) => route.name),
    [state.routes]
  );

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom,
        zIndex: 3000,
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
          shadowColor: "#000",
          shadowOpacity: 0.16,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 14,
        }}
      >
        {tabs.map((tab) => {
          const routeIndex = tabRouteNames.findIndex((name) => name === tab.routeName);
          const focused = !tab.isCenter && routeIndex === focusedIndex;
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
                if (routeIndex < 0) return;
                const route = state.routes[routeIndex];
                navigation.navigate(route.name, route.params);
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
