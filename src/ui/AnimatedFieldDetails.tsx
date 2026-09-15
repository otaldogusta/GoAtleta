import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Platform } from "react-native";

/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect -- React Native Animated values are stable mutable animation handles; visibility is synchronized with exit completion. */

/** Small conditional form fields: retain content until the exit finishes. */
export function AnimatedFieldDetails({ open, children, animateOnMount = false }: { open: boolean; children: ReactNode; animateOnMount?: boolean }) {
  const progress = useRef(new Animated.Value(open && !animateOnMount ? 1 : 0)).current;
  const [visible, setVisible] = useState(open);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (open) setVisible(true);
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : 160,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start(({ finished }) => {
      if (finished && !open) setVisible(false);
    });
    return () => animation.stop();
  }, [open, progress, reduceMotion]);

  if (!open && !visible) return null;
  return (
    <Animated.View
      pointerEvents={open ? "auto" : "none"}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
