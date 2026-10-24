import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, type ScrollView } from "react-native";
import { useCalendarFoldMotion } from "./CalendarFold";
import { useNativeCalendarGesture } from "./useNativeCalendarGesture";

export function sheetStop(progress: number, velocityY: number) {
  return Math.abs(velocityY) > 0.45 ? velocityY < 0 : progress >= 0.5;
}

/** One gesture owns the sheet until its stop, then passes remaining travel to the list. */
export function useEventSheetGesture(raised: boolean, setRaised: (value: boolean) => void, travel: number, listRef: React.RefObject<ScrollView | null>, offsetRef: React.RefObject<number>) {
  const nativeMotion = useNativeCalendarGesture(raised, setRaised, travel);
  const [interacting, setInteracting] = useState(false);
  const motion = useCalendarFoldMotion(raised, setRaised, 6, travel);
  const value = useRef(raised ? 1 : 0);
  const start = useRef({ y: 0, position: 0, scroll: 0, lastY: 0, time: 0, velocity: 0, dragging: false, listOnly: false });
  const ignoreClick = useRef(false);
  const active = useRef(false);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const id = motion.progress.addListener(({ value: next }) => { value.current = next; if (!active.current && (next <= 0 || next >= 1)) setInteracting(false); });
    return () => motion.progress.removeListener(id);
  }, [motion.progress]);
  useEffect(() => () => { if (wheelTimer.current) clearTimeout(wheelTimer.current); }, []);
  const snap = useCallback((velocity = 0) => {
    const next = sheetStop(value.current, velocity);
    setRaised(next);
    Animated.timing(motion.progress, { toValue: next ? 1 : 0, duration: motion.reduced ? 0 : 180, useNativeDriver: false }).start(({ finished }) => { if (finished) setInteracting(false); });
  }, [motion.progress, motion.reduced, setRaised]);
  const begin = useCallback((y: number, fromHandle = false) => {
    active.current = true;
    motion.progress.stopAnimation();
    start.current = { y, position: value.current, scroll: offsetRef.current, lastY: y, time: Date.now(), velocity: 0, dragging: false, listOnly: !fromHandle && raised && offsetRef.current > 0 };
    ignoreClick.current = false;
  }, [motion.progress, offsetRef, raised]);
  const move = useCallback((y: number) => {
    const gesture = start.current;
    const now = Date.now();
    gesture.velocity = (y - gesture.lastY) / Math.max(1, now - gesture.time);
    gesture.lastY = y; gesture.time = now;
    const dy = y - gesture.y;
    if (!gesture.dragging && Math.abs(dy) < 8) return false;
    gesture.dragging = true;
    setInteracting(true);
    const distance = Math.max(1, travel);
    const raw = gesture.position - dy / distance;
    if (gesture.listOnly) {
      offsetRef.current = Math.max(0, gesture.scroll - dy);
    } else {
      motion.progress.setValue(Math.max(0, Math.min(1, raw)));
      offsetRef.current = Math.max(0, (raw - 1) * distance);
    }
    listRef.current?.scrollTo({ y: offsetRef.current, animated: false });
    return true;
  }, [listRef, motion.progress, offsetRef, travel]);
  const release = useCallback(() => {
    active.current = false;
    if (!start.current.dragging) return;
    ignoreClick.current = true;
    snap(Date.now() - start.current.time < 100 ? start.current.velocity : 0);
    start.current.dragging = false;
  }, [snap]);
  type Pointer = { clientY: number; pointerId: number; currentTarget: HTMLElement; preventDefault: () => void };
  const pointerHandlers = Platform.OS === "web" ? {
    onPointerDown: (event: Pointer) => { begin(event.clientY); },
    onPointerMove: (event: Pointer) => {
      if (!active.current) return;
      if (move(event.clientY)) { event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); }
    },
    onPointerUp: () => { active.current = false; release(); },
    onPointerCancel: () => { active.current = false; snap(); },
    onClickCapture: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (ignoreClick.current) { ignoreClick.current = false; event.preventDefault(); event.stopPropagation(); }
    },
  } : {};
  type HandlePointer = Pointer & { stopPropagation: () => void };
  const handlePointerHandlers = Platform.OS === "web" ? {
    onPointerDown: (event: HandlePointer) => { event.stopPropagation(); begin(event.clientY, true); event.currentTarget.setPointerCapture(event.pointerId); },
    onPointerMove: (event: HandlePointer) => { event.stopPropagation(); pointerHandlers.onPointerMove!(event); },
    onPointerUp: (event: HandlePointer) => { event.stopPropagation(); active.current = false; release(); },
    onPointerCancel: (event: HandlePointer) => { event.stopPropagation(); active.current = false; snap(); },
  } : {};
  const claimNativeDrag = useCallback((dy: number, dx: number) => Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) && (!raised || offsetRef.current <= 0 && dy > 0), [raised, offsetRef]);
  // PanResponder stores these handlers; it does not invoke gesture callbacks during render.
  // eslint-disable-next-line react-hooks/refs
  const native = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => claimNativeDrag(g.dy, g.dx),
    onPanResponderGrant: (_, g) => begin(g.y0),
    onPanResponderMove: (_, g) => { move(g.moveY); },
    onPanResponderRelease: release,
    onPanResponderTerminate: () => snap(),
  }), [begin, claimNativeDrag, move, release, snap]);
  const wheel = (event: { deltaY: number; preventDefault: () => void }) => {
    if (raised && offsetRef.current > 0 || value.current >= 1 && event.deltaY > 0) return;
    setInteracting(true);
    motion.progress.stopAnimation();
    motion.progress.setValue(Math.max(0, Math.min(1, value.current + event.deltaY / Math.max(1, travel))));
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => snap(), 140);
  };
  return { ...motion, nativeMotion, interacting: nativeMotion?.interacting ?? interacting, handlePointerHandlers, pointerHandlers: pointerHandlers as object, wheel, panHandlers: Platform.OS === "web" ? {} : native.panHandlers };
}
