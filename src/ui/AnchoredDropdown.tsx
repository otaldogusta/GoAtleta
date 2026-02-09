import React from "react";
import {
    Animated,
    Dimensions,
    Platform,
    Pressable,
    ScrollView,
    StyleProp,
    View,
    ViewStyle,
} from "react-native";
import { useAppTheme } from "./app-theme";

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
  panelStyle?: StyleProp<ViewStyle>;
  scrollContentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  onRequestClose?: () => void;
  dismissOnBackdropPress?: boolean;
};

const DEFAULT_DROPDOWN_MAX_HEIGHT = 168;

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
  onRequestClose,
  dismissOnBackdropPress = !!onRequestClose,
}: AnchoredDropdownProps) {
  const { colors } = useAppTheme();
  if (!visible || !layout) return null;

  const resolvedMaxHeight = Math.min(maxHeight, DEFAULT_DROPDOWN_MAX_HEIGHT);
  const left = container ? layout.x - container.x : layout.x;
  const defaultTop = container
    ? layout.y - container.y + layout.height + 8
    : layout.y + layout.height + 8;
  const windowHeight = Dimensions.get("window").height;
  const availableBottom = windowHeight - 24;
  const top =
    defaultTop + resolvedMaxHeight > availableBottom
      ? Math.max(8, defaultTop - layout.height - resolvedMaxHeight)
      : defaultTop;

  const handleBackdropPress = () => {
    if (dismissOnBackdropPress && onRequestClose) {
      onRequestClose();
    }
  };

  return (
    <>
      {dismissOnBackdropPress && onRequestClose && (
        <Pressable
          onPress={handleBackdropPress}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: zIndex - 1,
            elevation: zIndex - 1,
          }}
        />
      )}
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
              maxHeight: resolvedMaxHeight,
              borderRadius: 12,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
            },
            panelStyle,
          ]}
        >
          <ScrollView
            style={{ maxHeight: resolvedMaxHeight }}
            contentContainerStyle={scrollContentStyle}
            nestedScrollEnabled={nestedScrollEnabled}
            showsVerticalScrollIndicator
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            overScrollMode={Platform.OS === "android" ? "always" : "auto"}
          >
            {children}
          </ScrollView>
        </View>
      </Animated.View>
    </>
  );
}
