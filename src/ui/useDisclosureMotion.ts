import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform } from "react-native";

/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect -- React Native Animated values are stable mutable animation handles; mounted state retains closing content. */

type DisclosureMotionOptions = { axis?: "x" | "y"; distance?: number; duration?: number };

/** Retains closing content; cancellation prevents rapid toggles from hiding a reopened view. */
export function useDisclosureMotion(open: boolean, { axis = "y", distance = -4, duration = 160 }: DisclosureMotionOptions = {}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { alive = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    let current = true;
    if (open) setMounted(true);
    if (reduced) {
      progress.setValue(open ? 1 : 0);
      if (!open) setMounted(false);
      return () => { current = false; };
    }
    const animation = Animated.timing(progress, { toValue: open ? 1 : 0, duration, useNativeDriver: Platform.OS !== "web" });
    animation.start(({ finished }) => { if (current && finished && !open) setMounted(false); });
    return () => { current = false; animation.stop(); };
  }, [open, progress, reduced, duration]);
  const translate = progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return { mounted: open || mounted, progress, reduced, style: { opacity: progress, transform: axis === "x" ? [{ translateX: translate }] : [{ translateY: translate }] } };
}
