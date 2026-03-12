import React, { useEffect, useRef } from "react";
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
  showVerticalScrollIndicator?: boolean;
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
  showVerticalScrollIndicator = true,
}: AnchoredDropdownProps) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !visible || !layout) return;

    const element = scrollRef.current as unknown as HTMLElement | null;
    if (!element || typeof element.addEventListener !== "function") return;

    const handleWheel = (event: WheelEvent) => {
      const canScroll = element.scrollHeight > element.clientHeight + 1;
      if (!canScroll) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const deltaY = event.deltaY;
      const atTop = element.scrollTop <= 0;
      const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
      const scrollingUp = deltaY < 0;
      const scrollingDown = deltaY > 0;

      event.stopPropagation();

      if ((atTop && scrollingUp) || (atBottom && scrollingDown)) {
        event.preventDefault();
      }
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [layout, visible]);

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
              borderRadius: 18,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
            panelStyle,
          ]}
        >
          <ScrollView
            ref={scrollRef}
            style={{ maxHeight: resolvedMaxHeight }}
            contentContainerStyle={[{ padding: 8, gap: 6 }, scrollContentStyle]}
            nestedScrollEnabled={nestedScrollEnabled}
            showsVerticalScrollIndicator={showVerticalScrollIndicator}
            persistentScrollbar={Platform.OS === "android"}
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
