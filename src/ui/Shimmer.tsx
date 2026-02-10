import { useEffect, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Animated, Easing, View } from "react-native";
import { useAppTheme } from "./app-theme";

type ShimmerBlockProps = {
  style: StyleProp<ViewStyle>;
};

export function ShimmerBlock({ style }: ShimmerBlockProps) {
  const { colors, mode } = useAppTheme();
  const anim = useRef(new Animated.Value(0)).current;
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
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
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
