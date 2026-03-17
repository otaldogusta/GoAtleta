import { useEffect, useRef } from "react";
import { Animated, View, type StyleProp, type ViewStyle } from "react-native";

import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

export type AnimatedSegmentedTabItem<T extends string> = {
  id: T;
  label: string;
};

type AnimatedSegmentedTabsProps<T extends string> = {
  tabs: ReadonlyArray<AnimatedSegmentedTabItem<T>>;
  activeTab: T;
  onChange: (tab: T) => void;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedSegmentedTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  style,
}: AnimatedSegmentedTabsProps<T>) {
  const { colors } = useAppTheme();
  const animRef = useRef<Record<string, Animated.Value>>({});

  const getProgress = (tabId: T) => {
    if (!animRef.current[tabId]) {
      animRef.current[tabId] = new Animated.Value(activeTab === tabId ? 1 : 0);
    }
    return animRef.current[tabId];
  };

  useEffect(() => {
    tabs.forEach((tab) => {
      const value = getProgress(tab.id);
      if (!value) return;
      Animated.timing(value, {
        toValue: activeTab === tab.id ? 1 : 0,
        duration: 320,
        useNativeDriver: false,
      }).start();
    });
  }, [activeTab, tabs]);

  return (
    <View
      style={[
        {
          flexDirection: "row",
          gap: 8,
          backgroundColor: colors.secondaryBg,
          padding: 6,
          borderRadius: 999,
          position: "relative",
          zIndex: 1,
        },
        style,
      ]}
    >
      {tabs.map((tab) => {
        const progress = getProgress(tab.id);
        const tabScale = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.95, 1],
        });
        const tabOpacity = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.68, 1],
        });
        const tabBackground = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["transparent", colors.primaryBg],
        });
        const tabTextColor = progress.interpolate({
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
              onPress={() => onChange(tab.id)}
              style={{
                paddingVertical: 8,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                minHeight: 36,
              }}
            >
              <Animated.Text
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
