import { useEffect, useState } from "react";
import { Animated, View, type StyleProp, type ViewStyle } from "react-native";

import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

export type AnimatedSegmentedTabItem<T extends string> = {
  id: T;
  label: string;
};

type AnimatedSegmentedTabsProps<T extends string> = {
  tabs: readonly AnimatedSegmentedTabItem<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  style?: StyleProp<ViewStyle>;
  activeBackgroundColor?: string;
  inactiveBackgroundColor?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
  itemMinHeight?: number;
  itemPaddingVertical?: number;
  itemFontSize?: number;
  itemGap?: number;
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
  itemFontSize = 12,
  itemGap = 6,
}: AnimatedSegmentedTabsProps<T>) {
  const { colors } = useAppTheme();
  const containerRadius = 999;

  return (
    <View
      style={[
        {
          flexDirection: "row",
          gap: itemGap,
          backgroundColor: "transparent",
          padding: 0,
          borderRadius: containerRadius,
          position: "relative",
          zIndex: 1,
        },
        style,
      ]}
    >
      {tabs.map((tab) => (
        <AnimatedTabButton
          key={tab.id}
          tab={tab}
          active={activeTab === tab.id}
          onChange={onChange}
          activeBackgroundColor={activeBackgroundColor ?? colors.primaryBg}
          inactiveBackgroundColor={inactiveBackgroundColor ?? colors.card}
          activeTextColor={activeTextColor ?? colors.primaryText}
          inactiveTextColor={inactiveTextColor ?? colors.text}
          itemMinHeight={itemMinHeight}
          itemPaddingVertical={itemPaddingVertical}
          itemFontSize={itemFontSize}
        />
      ))}    </View>
  );
}

// Each keyed tab owns its animation, including tabs added after the first render.
function AnimatedTabButton<T extends string>({
  tab, active, onChange, activeBackgroundColor, inactiveBackgroundColor,
  activeTextColor, inactiveTextColor, itemMinHeight, itemPaddingVertical, itemFontSize,
}: {
  tab: AnimatedSegmentedTabItem<T>;
  active: boolean;
} & Required<Pick<AnimatedSegmentedTabsProps<T>,
  'onChange' | 'activeBackgroundColor' | 'inactiveBackgroundColor' |
  'activeTextColor' | 'inactiveTextColor' | 'itemMinHeight' |
  'itemPaddingVertical' | 'itemFontSize'>>) {
  const [progress] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 320,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, progress]);
  const tabBackground = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveBackgroundColor, activeBackgroundColor],
  });
  const tabTextColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveTextColor, activeTextColor],
  });
  return (
    <Animated.View style={{ flex: 1, minWidth: 0, borderRadius: 999,
      backgroundColor: tabBackground, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={(event) => {
          event.stopPropagation?.();
          onChange(tab.id);
        }}
        style={{ paddingVertical: itemPaddingVertical, borderRadius: 999,
          alignItems: 'center', justifyContent: 'center', minHeight: itemMinHeight, minWidth: 0 }}
      >
        <Animated.Text numberOfLines={1}
          style={{ color: tabTextColor, fontWeight: '700', fontSize: itemFontSize }}>
          {tab.label}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}
