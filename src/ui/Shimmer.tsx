import { useEffect, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Animated, Easing, View } from "react-native";
import { useAppTheme } from "./app-theme";

type ShimmerBlockProps = {
  style: StyleProp<ViewStyle>;
};

let shimmerProgress: Animated.Value | null = null;
let shimmerLoop: Animated.CompositeAnimation | null = null;
let shimmerConsumers = 0;

const getShimmerProgress = () => {
  if (!shimmerProgress) {
    shimmerProgress = new Animated.Value(0);
  }
  return shimmerProgress;
};

const startShimmerLoop = () => {
  if (shimmerLoop) return;
  const progress = getShimmerProgress();
  progress.setValue(0);
  shimmerLoop = Animated.loop(
    Animated.timing(progress, {
      toValue: 1,
      duration: 1500,
      easing: Easing.linear,
      useNativeDriver: true,
    })
  );
  shimmerLoop.start();
};

const stopShimmerLoop = () => {
  if (!shimmerLoop) return;
  shimmerLoop.stop();
  shimmerLoop = null;
  getShimmerProgress().setValue(0);
};

const acquireShimmerDriver = () => {
  shimmerConsumers += 1;
  if (shimmerConsumers === 1) {
    startShimmerLoop();
  }
};

const releaseShimmerDriver = () => {
  shimmerConsumers = Math.max(0, shimmerConsumers - 1);
  if (shimmerConsumers === 0) {
    stopShimmerLoop();
  }
};

export function ShimmerBlock({ style }: ShimmerBlockProps) {
  const { mode } = useAppTheme();
  const anim = useRef(getShimmerProgress()).current;
  const [width, setWidth] = useState(0);
  const glassBase = mode === "dark"
    ? "rgba(255, 255, 255, 0.10)"
    : "rgba(15, 23, 42, 0.06)";
  const glassSheen = mode === "dark"
    ? "rgba(255, 255, 255, 0.22)"
    : "rgba(15, 23, 42, 0.12)";
  const baseColor = glassBase;
  const sheenColor = glassSheen;

  useEffect(() => {
    acquireShimmerDriver();
    return () => releaseShimmerDriver();
  }, [anim]);

  const shimmerWidth = Math.max(120, width * 0.8);
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-shimmerWidth, width + shimmerWidth],
  });

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        {
          backgroundColor: baseColor,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -6,
            bottom: -6,
            width: shimmerWidth,
            backgroundColor: sheenColor,
            opacity: 0.18,
            transform: [{ translateX }],
          }}
        />
      ) : null}
    </View>
  );
}
