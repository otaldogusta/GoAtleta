import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { CalendarTimeWheels, useCalendarReducedMotion } from "./CalendarTimePicker";

export function CalendarInlineTimePicker({ open, value, onChange, targetKey, disabled = false }: {
  open: boolean; value: string; onChange: (value: string) => void; targetKey: string; disabled?: boolean;
}) {
  return <CalendarPickerDisclosure open={open && !disabled} testID="calendar-inline-time-picker">
    <CalendarTimeWheels key={targetKey} value={value} onChange={onChange} disabled={disabled || !open} />
  </CalendarPickerDisclosure>;
}

/** One interruptible disclosure for the event form's date and time controls. */
export function CalendarPickerDisclosure({ open, children, testID, initialHeight = 180, contentPaddingVertical = 12 }: {
  open: boolean; children: ReactNode; testID: string; initialHeight?: number; contentPaddingVertical?: number;
}) {
  const reduced = useCalendarReducedMotion();
  const [progress] = useState(() => new Animated.Value(open ? 1 : 0));
  const [animatedHeight] = useState(() => new Animated.Value(open ? initialHeight : 0));
  const [mounted, setMounted] = useState(false);
  if (mounted !== open && (open || reduced)) setMounted(open);
  const [height, setHeight] = useState(initialHeight);
  const generation = useRef(0);
  useLayoutEffect(() => {
    const current = ++generation.current;
    progress.stopAnimation();
    animatedHeight.stopAnimation();
    if (reduced) {
      progress.setValue(open ? 1 : 0);
      animatedHeight.setValue(open ? height : 0);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(animatedHeight, { toValue: open ? height : 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(progress, { toValue: open ? 1 : 0, duration: open ? 160 : 120, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]);
    animation.start(({ finished }) => {
      if (finished && !open && generation.current === current) setMounted(false);
    });
    return () => { generation.current += 1; animation.stop(); };
  }, [open, height, animatedHeight, progress, reduced]);

  if (!open && !mounted) return null;
  return <Animated.View testID={testID}
    pointerEvents={open ? "auto" : "none"}
    accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"}
    aria-hidden={!open}
    {...(Platform.OS === "web" ? { inert: !open } : {})}
    style={{ width: "100%", height: animatedHeight, opacity: progress, overflow: "hidden" }}>
    <View testID={`${testID}-content`} onLayout={event => {
      const next = event.nativeEvent.layout.height;
      if (next > 0) setHeight(current => current === next ? current : next);
    }} style={{ position: "absolute", top: 0, left: 0, right: 0, paddingVertical: contentPaddingVertical }}>
      {children}
    </View>
  </Animated.View>;
}
