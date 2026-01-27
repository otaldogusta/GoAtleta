import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { ScrollView, View } from "react-native";
import { toRgba } from "./unit-colors";
import { useAppTheme } from "./app-theme";

type FadeHorizontalScrollProps = Omit<
  ScrollViewProps,
  "horizontal" | "showsHorizontalScrollIndicator" | "contentContainerStyle" | "style"
> & {
  children: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  scrollStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  fadeWidth?: number;
  fadeColor?: string;
};

export function FadeHorizontalScroll({
  children,
  containerStyle,
  scrollStyle,
  contentContainerStyle,
  fadeWidth = 36,
  fadeColor,
  ...scrollProps
}: FadeHorizontalScrollProps) {
  const { colors } = useAppTheme();
  const fadeTo = fadeColor ?? colors.card;
  const fadeStrong = fadeTo.startsWith("#") ? toRgba(fadeTo, 0.95) : fadeTo;
  const fadeMid = fadeTo.startsWith("#") ? toRgba(fadeTo, 0.7) : fadeTo;
  const fadeSoft = fadeTo.startsWith("#") ? toRgba(fadeTo, 0.4) : fadeTo;
  const fadeSteps = [
    { color: fadeStrong, opacity: 1 },
    { color: fadeMid, opacity: 0.85 },
    { color: fadeMid, opacity: 0.65 },
    { color: fadeSoft, opacity: 0.45 },
    { color: fadeSoft, opacity: 0.25 },
    { color: fadeSoft, opacity: 0.1 },
  ];
  const stepWidth = fadeWidth / fadeSteps.length;
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const showLeftRef = useRef(false);
  const showRightRef = useRef(false);
  const scrollXRef = useRef(0);
  const contentWidthRef = useRef(0);
  const layoutWidthRef = useRef(0);

  const setVisibility = useCallback((nextLeft: boolean, nextRight: boolean) => {
    if (showLeftRef.current !== nextLeft) {
      showLeftRef.current = nextLeft;
      setShowLeft(nextLeft);
    }
    if (showRightRef.current !== nextRight) {
      showRightRef.current = nextRight;
      setShowRight(nextRight);
    }
  }, []);

  const updateVisibility = useCallback(
    (offset?: number) => {
      const layoutWidth = layoutWidthRef.current;
      const contentWidth = contentWidthRef.current;
      if (!layoutWidth || !contentWidth || contentWidth <= layoutWidth + 1) {
        setVisibility(false, false);
        return;
      }
      const scrollX = offset ?? scrollXRef.current;
      const maxScroll = Math.max(0, contentWidth - layoutWidth);
      const threshold = 4;
      const nextLeft = scrollX > threshold;
      const nextRight = scrollX < maxScroll - threshold;
      setVisibility(nextLeft, nextRight);
    },
    [setVisibility]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollXRef.current = event.nativeEvent.contentOffset.x ?? 0;
      updateVisibility(scrollXRef.current);
      scrollProps.onScroll?.(event);
    },
    [scrollProps, updateVisibility]
  );

  return (
    <View
      style={[
        {
          position: "relative",
          overflow: "hidden",
        },
        containerStyle,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={scrollStyle}
        contentContainerStyle={[{ paddingRight: fadeWidth }, contentContainerStyle]}
        onStartShouldSetResponderCapture={() => false}
        onContentSizeChange={(width) => {
          contentWidthRef.current = width;
          updateVisibility();
        }}
        onLayout={(event) => {
          layoutWidthRef.current = event.nativeEvent.layout.width;
          updateVisibility();
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        {...scrollProps}
      >
        {children}
      </ScrollView>
      {showLeft
        ? fadeSteps.map((step, index) => (
            <View
              key={`fade-left-${index}`}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: index * stepWidth,
                top: 0,
                bottom: 0,
                width: stepWidth + 0.5,
                backgroundColor: step.color,
                opacity: step.opacity,
              }}
            />
          ))
        : null}
      {showRight
        ? fadeSteps.map((step, index) => (
            <View
              key={`fade-right-${index}`}
              pointerEvents="none"
              style={{
                position: "absolute",
                right: index * stepWidth,
                top: 0,
                bottom: 0,
                width: stepWidth + 0.5,
                backgroundColor: step.color,
                opacity: step.opacity,
              }}
            />
          ))
        : null}
    </View>
  );
}
