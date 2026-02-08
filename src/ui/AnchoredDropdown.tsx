import React from "react";
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";

type Layout = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

type AnchoredDropdownProps = {
  visible: boolean;
  layout: Layout | null;
  container: Point | null;
  animationStyle: StyleProp<ViewStyle>;
  zIndex: number;
  maxHeight: number;
  nestedScrollEnabled: boolean;
  panelStyle: StyleProp<ViewStyle>;
  scrollContentStyle: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export function AnchoredDropdown({
  visible,
  layout,
  container,
  animationStyle,
  zIndex = 300,
  maxHeight = 220,
  nestedScrollEnabled = false,
  panelStyle,
  scrollContentStyle,
  children,
}: AnchoredDropdownProps) {
  if (!visible || !layout) return null;

  const left = container ? layout.x - container.x : layout.x;
  const defaultTop = container
    ? layout.y - container.y + layout.height + 8
    : layout.y + layout.height + 8;
  const windowHeight = Dimensions.get("window").height;
  const availableBottom = windowHeight - 24;
  const top =
    defaultTop + maxHeight > availableBottom
      ? Math.max(8, defaultTop - layout.height - maxHeight)
      : defaultTop;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left,
          top,
          width: layout.width,
          zIndex,
          elevation: zIndex,
        },
        animationStyle,
      ]}
    >
      <View
        style={[
          {
            maxHeight,
            borderRadius: 12,
            overflow: "hidden",
          },
          panelStyle,
        ]}
      >
        <ScrollView
          style={{ maxHeight }}
          contentContainerStyle={scrollContentStyle}
          nestedScrollEnabled={nestedScrollEnabled}
          showsVerticalScrollIndicator
        >
          {children}
        </ScrollView>
      </View>
    </Animated.View>
  );
}
