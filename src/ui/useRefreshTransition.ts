import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";

export function useRefreshTransition(refreshing: boolean, immediateEntry = false) {
  const [progress] = useState(() => new Animated.Value(0));
  const [visible, setVisible] = useState(refreshing);
  const [previousRefreshing, setPreviousRefreshing] = useState(refreshing);
  const [reducedMotion, setReducedMotion] = useState(false);
  if (previousRefreshing !== refreshing) {
    setPreviousRefreshing(refreshing);
    if (refreshing) setVisible(true);
  }

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReducedMotion(value);
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: refreshing ? 1 : 0,
      duration: reducedMotion ? 0 : refreshing ? immediateEntry ? 0 : 120 : immediateEntry ? 420 : 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished && !refreshing) setVisible(false);
    });
    return () => animation.stop();
  }, [progress, reducedMotion, refreshing, immediateEntry]);

  return { visible, progress, contentOpacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) };
}
