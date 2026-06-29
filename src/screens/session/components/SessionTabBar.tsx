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
        backgroundColor: "transparent",
        padding: 0,
        borderRadius: 999,
        marginBottom: 12,
      }}
    >
      {tabs.map((tab) => {
        const tabProgress = tabAnimations[tab.id];
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
              minWidth: 0,
              borderRadius: 999,
              backgroundColor: tabBackground,
              overflow: "hidden",
            }}
          >
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.id }}
              onPress={() => onSelectTab(tab.id)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                minHeight: 40,
                minWidth: 0,
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
