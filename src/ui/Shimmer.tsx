import { useEffect, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Animated, Easing, View } from "react-native";
import { useAppTheme } from "./app-theme";
import { toRgba } from "./unit-colors";

type ShimmerBlockProps = {
  style?: StyleProp<ViewStyle>;
};

export function ShimmerBlock({ style }: ShimmerBlockProps) {
  const { colors } = useAppTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const baseColor = colors.inputBg;
  const sheenBase = colors.card;
  const sheenColor = sheenBase.startsWith("#") ? toRgba(sheenBase, 0.7) : sheenBase;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const shimmerWidth = Math.max(90, width * 0.55);
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
            opacity: 0.65,
            transform: [{ translateX }, { skewX: "-15deg" }],
          }}
        />
      ) : null}
    </View>
  );
}
