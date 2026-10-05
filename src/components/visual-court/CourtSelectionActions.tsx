import { Children, isValidElement, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

export function CourtSelectionActions({ visible, left, top, children }: {
  visible: boolean; left: number; top: number; children: ReactNode;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const [retained, setRetained] = useState<{ left: number; top: number; children: ReactNode } | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  if (visible && (!retained || retained.left !== left || retained.top !== top || retained.children !== children)) {
    setRetained({ left, top, children });
  }
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0, duration: reduceMotion ? 0 : visible ? 180 : 130,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished && !visible) setRetained(null); });
    return () => animation.stop();
  }, [visible, reduceMotion, progress]);
  if (!retained) return null;
  const actions = isValidElement<{ children?: ReactNode }>(retained.children)
    ? Children.toArray(retained.children.props.children) : Children.toArray(retained.children);
  return <Animated.View nativeID="court-selection-actions" pointerEvents={visible ? "box-none" : "none"}
    onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
    style={{ position: "absolute", left: retained.left, top: retained.top, width: 68, height: 176, zIndex: 30 }}>
    {actions.map((action, index) => <Animated.View key={index} pointerEvents="box-none" style={{ position: "absolute", left: index === 0 || index === actions.length - 1 ? 24 : 0, top: index * 44,
      opacity: progress, transform: [
        { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [44, 0] }) },
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [66 - index * 44, 0] }) },
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
      ],
    }}>{action}</Animated.View>)}
  </Animated.View>;
}
