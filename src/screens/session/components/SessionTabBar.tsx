import { Animated, View } from "react-native";

import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";
import type { SessionTabId, SessionTabItem } from "./session-training-ui-types";

type Props = {
  colors: ThemeColors;
  tabs: readonly SessionTabItem[];
  activeTab: SessionTabId;
  tabAnimations: Record<SessionTabId, Animated.Value>;
  onSelectTab: (tab: SessionTabId) => void;
};

export function SessionTabBar({
  colors,
  tabs,
  activeTab,
  tabAnimations,
  onSelectTab,
}: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 6,
        backgroundColor: colors.secondaryBg,
        padding: 6,
        borderRadius: 999,
        marginBottom: 12,
      }}
    >
      {tabs.map((tab) => {
        const tabProgress = tabAnimations[tab.id];
        const tabScale = tabProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.95, 1],
        });
        const tabOpacity = tabProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.68, 1],
        });
        const tabBackground = tabProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [colors.card, colors.primaryBg],
        });
        const tabTextColor = tabProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [colors.text, colors.primaryText],
        });
        return (
          <Animated.View
            key={tab.id}
            style={{
              flex: 1,
              borderRadius: 999,
              opacity: tabOpacity,
              transform: [{ scale: tabScale }],
              backgroundColor: tabBackground,
            }}
          >
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.id }}
              onPress={() => onSelectTab(tab.id)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 999,
                alignItems: "center",
              }}
            >
              <Animated.Text
                numberOfLines={1}
                style={{
                  color: tabTextColor,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {tab.label}
              </Animated.Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
