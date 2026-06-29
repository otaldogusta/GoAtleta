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
  activeBackgroundColor?: string;
  inactiveBackgroundColor?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
  itemMinHeight?: number;
  itemPaddingVertical?: number;
};

export function AnimatedSegmentedTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  style,
  activeBackgroundColor,
  inactiveBackgroundColor,
  activeTextColor,
  inactiveTextColor,
  itemMinHeight = 40,
  itemPaddingVertical = 10,
}: AnimatedSegmentedTabsProps<T>) {
  const { colors } = useAppTheme();
  const animRef = useRef<Record<string, Animated.Value>>({});
  const containerRadius = 999;
  const itemRadius = 999;

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
          gap: 6,
          backgroundColor: "transparent",
          padding: 0,
          borderRadius: containerRadius,
          position: "relative",
          zIndex: 1,
        },
        style,
      ]}
    >
      {tabs.map((tab) => {
        const progress = getProgress(tab.id);
        const tabBackground = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [
            inactiveBackgroundColor ?? colors.card,
            activeBackgroundColor ?? colors.primaryBg,
          ],
        });
        const tabTextColor = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [
            inactiveTextColor ?? colors.text,
            activeTextColor ?? colors.primaryText,
          ],
        });

        return (
          <Animated.View
            key={tab.id}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: itemRadius,
              backgroundColor: tabBackground,
              overflow: "hidden",
            }}
          >
            <Pressable
              onPress={(event) => {
                event.stopPropagation?.();
                onChange(tab.id);
              }}
              style={{
                paddingVertical: itemPaddingVertical,
                borderRadius: itemRadius,
                alignItems: "center",
                justifyContent: "center",
                minHeight: itemMinHeight,
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
