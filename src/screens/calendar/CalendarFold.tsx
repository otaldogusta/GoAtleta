import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, PanResponder, Platform, View } from "react-native";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { foldCalendarAfterDrag } from "./application/calendar-selection";
import { NativeCalendarFold } from "./NativeCalendarFold";
import type { NativeCalendarMotion } from "./useNativeCalendarGesture";

export function useCalendarFoldMotion(collapsed: boolean, onChange: (collapsed: boolean) => void, rowCount: number, dragDistance?: number, canDrag?: (dy: number) => boolean) {
  const [progress] = useState(() => new Animated.Value(collapsed ? 1 : 0));
  const [reduced, setReduced] = useState(true);
  const rowHeight = 59;
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: collapsed ? 1 : 0, duration: reduced ? 0 : 180, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [collapsed, progress, reduced]);
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) && (canDrag?.(gesture.dy) ?? true),
    onPanResponderMove: (_, gesture) => {
      progress.stopAnimation(); progress.setValue(Math.max(0, Math.min(1, (collapsed ? 1 : 0) - gesture.dy / Math.max(1, dragDistance ?? (rowCount - 1) * rowHeight))));
    },
    onPanResponderRelease: (_, gesture) => {
      const next = foldCalendarAfterDrag(collapsed, gesture.dy);
      onChange(next);
      Animated.timing(progress, { toValue: next ? 1 : 0, duration: reduced ? 0 : 180, useNativeDriver: false }).start();
    },
    onPanResponderTerminate: () => { Animated.timing(progress, { toValue: collapsed ? 1 : 0, duration: reduced ? 0 : 180, useNativeDriver: false }).start(); },
  }), [collapsed, onChange, progress, reduced, rowCount, dragDistance, canDrag]);
  const ignoreClick = useRef(false);
  const mouseStart = useRef<{ y: number; dragging: boolean } | null>(null);
  type Pointer = { pointerType: string; clientY: number; pointerId: number; currentTarget: HTMLElement; preventDefault: () => void };
  const mouseHandlers = Platform.OS === "web" ? {
    onPointerDown: (event: Pointer) => { if (event.pointerType === "mouse") { ignoreClick.current = false; mouseStart.current = { y: event.clientY, dragging: false }; event.currentTarget.setPointerCapture(event.pointerId); } },
    onPointerMove: (event: Pointer) => {
      const start = mouseStart.current;
      if (!start) return;
      const distance = event.clientY - start.y;
      if (Math.abs(distance) < 8 && !start.dragging) return;
      start.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      progress.stopAnimation(); progress.setValue(Math.max(0, Math.min(1, (collapsed ? 1 : 0) - distance / Math.max(1, dragDistance ?? (rowCount - 1) * rowHeight))));
    },
    onPointerUp: (event: Pointer) => {
      const start = mouseStart.current;
      mouseStart.current = null;
      if (!start?.dragging) return;
      ignoreClick.current = true;
      event.preventDefault();
      const next = foldCalendarAfterDrag(collapsed, event.clientY - start.y);
      onChange(next);
      Animated.timing(progress, { toValue: next ? 1 : 0, duration: reduced ? 0 : 180, useNativeDriver: false }).start();
    },
    onPointerCancel: () => { mouseStart.current = null; Animated.timing(progress, { toValue: collapsed ? 1 : 0, duration: reduced ? 0 : 180, useNativeDriver: false }).start(); },
  } : {};
  return { progress, reduced, panHandlers: responder.panHandlers, mouseHandlers, consumeDragClick: () => { const ignore = ignoreClick.current; ignoreClick.current = false; return ignore; } };
}

export function CalendarFold({ rows, selectedRow, collapsed, progress, rowHeight = 59, nativeMotion }: {
  rows: ReactNode[]; selectedRow: number; collapsed: boolean; progress: Animated.Value; rowHeight?: number; nativeMotion?: NativeCalendarMotion | null;
}) {
  if (nativeMotion) return <NativeCalendarFold rows={rows} selectedRow={selectedRow} rowHeight={rowHeight} motion={nativeMotion} />;
  return (

    <Animated.View style={{ height: progress.interpolate({ inputRange: [0, 1], outputRange: [rows.length * rowHeight, rowHeight] }), overflow: "hidden" }}>
      <Animated.View style={{ transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.max(0, selectedRow) * rowHeight] }) }] }}>
        {rows.map((row, index) => <View key={index} accessibilityElementsHidden={collapsed && index !== selectedRow} importantForAccessibility={collapsed && index !== selectedRow ? "no-hide-descendants" : "auto"} style={{ height: rowHeight, ...(Platform.OS === "web" && collapsed && index !== selectedRow ? { visibility: "hidden" as const } : {}) }}>{row}</View>)}
      </Animated.View>
    </Animated.View>
  );
}

export function CalendarFoldHandle({ collapsed, onChange, panHandlers, mouseHandlers, consumeDragClick, expandLabel = "Expandir mês", collapseLabel = "Recolher para a semana" }: {
  collapsed: boolean; onChange: (collapsed: boolean) => void;
  panHandlers: object; mouseHandlers?: object; consumeDragClick?: () => boolean;
  expandLabel?: string; collapseLabel?: string;
}) {
  const { colors } = useAppTheme();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return <View {...panHandlers} style={{ marginTop: -12, marginBottom: -8, ...(Platform.OS === "web" ? { touchAction: "none" } as object : {}) }}>
    <Pressable {...mouseHandlers} suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={collapsed ? expandLabel : collapseLabel} accessibilityState={{ expanded: !collapsed }} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} onPress={() => { if (!consumeDragClick?.()) onChange(!collapsed); }} style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: hovered || pressed ? colors.text : colors.muted }} />
    </Pressable>
  </View>;
}
