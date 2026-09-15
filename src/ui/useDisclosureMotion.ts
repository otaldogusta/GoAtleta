import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform } from "react-native";

/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect -- React Native Animated values are stable mutable animation handles; mounted state retains closing content. */

/** Retains closing content; cancellation prevents rapid toggles from hiding a reopened view. */
export function useDisclosureMotion(open: boolean) {
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
    if (open) setMounted(true);
    const animation = Animated.timing(progress, { toValue: open ? 1 : 0, duration: reduced ? 0 : 160, useNativeDriver: Platform.OS !== "web" });
    animation.start(({ finished }) => { if (finished && !open) setMounted(false); });
    return () => animation.stop();
  }, [open, progress, reduced]);
  return { mounted: open || mounted, style: { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }] } };
}
