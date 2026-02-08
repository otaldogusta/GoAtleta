import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

type CollapsibleOptions = {
  durationIn: number;
  durationOut: number;
  translateY: number;
};

export function useCollapsibleAnimation(
  open: boolean,
  options: CollapsibleOptions = {}
) {
  const { durationIn = 180, durationOut = 160, translateY = -8 } = options;
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setVisible(true);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: durationIn,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: durationOut,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [open, anim, durationIn, durationOut]);

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

  return { animatedStyle, isVisible: visible };
}
