import { useLayoutEffect, useState } from "react";
import { Animated, Platform } from "react-native";

type CollapsibleOptions = {
  durationIn?: number;
  durationOut?: number;
  translateY?: number;
};

export function useCollapsibleAnimation(
  open: boolean,
  options: CollapsibleOptions = {}
) {
  const { durationIn = 180, durationOut = 160, translateY = -8 } = options;
  const [anim] = useState(() => new Animated.Value(open ? 1 : 0));
  const [isMountedVisible, setIsMountedVisible] = useState(open);

  // Reset before the browser paints: a reopened list still holds opacity 1
  // from its previous animation and would otherwise flash before fading in.
  useLayoutEffect(() => {
    const isNativeAnimation = Platform.OS === "ios" || Platform.OS === "android";
    if (open) {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: durationIn,
        useNativeDriver: isNativeAnimation,
      }).start();
      return () => anim.stopAnimation();
    }
    if (!isMountedVisible) return;
    Animated.timing(anim, {
      toValue: 0,
      duration: durationOut,
      useNativeDriver: isNativeAnimation,
    }).start(({ finished }) => {
      if (finished) setIsMountedVisible(false);
    });
    return () => anim.stopAnimation();
  }, [isMountedVisible, open, anim, durationIn, durationOut]);

  const animatedStyle = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [translateY, 0],
        }),
      },
    ],
  };

  return { animatedStyle, isVisible: open || isMountedVisible };
}
