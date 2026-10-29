import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Animated, PanResponder, Platform, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, type View } from "react-native";
import { useCalendarFoldMotion } from "./CalendarFold";
import { useNativeCalendarGesture } from "./useNativeCalendarGesture";
import { calendarDragParts, calendarDragPosition } from "./application/calendar-drag";
import { advanceCalendarWebPosition } from "./application/calendar-web-drag";

// Small mouse-wheel steps can be spaced farther apart than trackpad frames.
const WHEEL_IDLE_MS = 350;
const WEB_FOLD_GAIN = 0.5;

export function sheetStop(progress: number, velocityY: number) {
  return Math.abs(velocityY) > 0.45 ? velocityY < 0 : progress >= 0.5;
}

/** Native non-passive wheel listener: React's delegated wheel listener can be passive. */
export function useCalendarWheel(targetRef: RefObject<View | null>, wheel: (event: WheelEvent) => void) {
  const attached = useRef<{ node: HTMLElement; wheel: (event: WheelEvent) => void } | null>(null);
  // Check the node after each commit because a loading state can mount it later.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = targetRef.current as unknown as HTMLElement | null;
    if (attached.current?.node === node && attached.current?.wheel === wheel) return;
    if (attached.current) attached.current.node.removeEventListener("wheel", attached.current.wheel);
    attached.current = null;
    if (!node?.addEventListener) return;
    node.addEventListener("wheel", wheel, { passive: false });
    attached.current = { node, wheel };
  });
  useEffect(() => () => {
    if (attached.current) attached.current.node.removeEventListener("wheel", attached.current.wheel);
    attached.current = null;
  }, []);
}

/** One gesture owns the sheet until its stop, then passes remaining travel to the list. */
export function useEventSheetGesture(raised: boolean, setRaised: (value: boolean) => void, travel: number, listRef: React.RefObject<ScrollView | null>, offsetRef: React.RefObject<number>) {
  const nativeMotion = useNativeCalendarGesture(raised, setRaised, travel);
  const [interacting, setInteracting] = useState(false);
  // This adapter owns settling, including external handle/keyboard changes.
  const motion = useCalendarFoldMotion(raised, setRaised, 6, travel, undefined, false);
  const value = useRef(raised ? 1 : 0);
  const start = useRef({ y: 0, position: 0, lastY: 0, time: 0, velocity: 0, dragging: false, folding: false, viewport: null as number | null });
  const listMeasurements = useRef<{ contentHeight: number | null; collapsedViewport: number | null }>({ contentHeight: null, collapsedViewport: null });
  const ignoreClick = useRef(false);
  const active = useRef(false);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const settling = useRef<{ target: boolean; reduced: boolean } | null>(null);
  const clearWheelTimer = useCallback(() => {
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = null;
  }, []);
  const readListNode = useCallback(() => {
    if (Platform.OS !== "web") return null;
    return listRef.current?.getScrollableNode?.() as HTMLElement | null;
  }, [listRef]);
  const readCollapsedViewport = useCallback(() => {
    const node = readListNode();
    if (node?.clientHeight) {
      const remainingFold = Math.max(0, travel - value.current * travel);
      return node.clientHeight + remainingFold;
    }
    return listMeasurements.current.collapsedViewport;
  }, [readListNode, travel]);
  const readMaxScroll = useCallback(() => {
    const viewport = active.current ? start.current.viewport : readCollapsedViewport();
    const content = readListNode()?.scrollHeight ?? listMeasurements.current.contentHeight;
    return viewport !== null && content != null ? Math.max(0, content - viewport) : 0;
  }, [readCollapsedViewport, readListNode]);
  const onListLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) listMeasurements.current.collapsedViewport = height + Math.max(0, travel - value.current * travel);
  }, [travel]);
  const onListContentSizeChange = useCallback((_width: number, height: number) => {
    listMeasurements.current.contentHeight = height;
  }, []);
  const onListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const node = readListNode();
    const offset = node?.scrollTop ?? event.nativeEvent.contentOffset.y;
    offsetRef.current = value.current < 1 ? 0 : Math.max(0, Math.min(readMaxScroll(), offset));
  }, [offsetRef, readListNode, readMaxScroll]);
  const applyPosition = useCallback((position: number) => {
    const parts = calendarDragParts(position, Math.max(1, travel));
    motion.progress.setValue(parts.fold / Math.max(1, travel));
    offsetRef.current = parts.scroll;
    listRef.current?.scrollTo({ y: parts.scroll, animated: false });
    return parts;
  }, [listRef, motion.progress, offsetRef, travel]);
  useEffect(() => {
    const id = motion.progress.addListener(({ value: next }) => { value.current = next; if (!active.current && (next <= 0 || next >= 1)) setInteracting(false); });
    return () => motion.progress.removeListener(id);
  }, [motion.progress]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      clearWheelTimer();
      motion.progress.stopAnimation();
    };
  }, [clearWheelTimer, motion.progress]);
  const settleTo = useCallback((target: boolean) => {
    // Explicit handle/keyboard expansion has no input delta to consume the list.
    // Start that transition at list offset zero, as the native position=0 stop does.
    if (!target && (offsetRef.current > 0 || (readListNode()?.scrollTop ?? 0) > 0)) {
      offsetRef.current = 0;
      listRef.current?.scrollTo({ y: 0, animated: false });
    }
    if (settling.current?.target === target && settling.current.reduced === motion.reduced) return;
    clearWheelTimer();
    const request = ++generation.current;
    settling.current = null;
    motion.progress.stopAnimation();
    if (value.current === (target ? 1 : 0)) {
      if (!active.current) setInteracting(false);
      return;
    }
    settling.current = { target, reduced: motion.reduced };
    Animated.timing(motion.progress, { toValue: target ? 1 : 0, duration: motion.reduced ? 0 : 180, useNativeDriver: false }).start(({ finished }) => {
      if (!mounted.current || request !== generation.current || active.current) return;
      settling.current = null;
      if (finished) setInteracting(false);
    });
  }, [clearWheelTimer, listRef, motion.progress, motion.reduced, offsetRef, readListNode]);
  useEffect(() => { if (!active.current) settleTo(raised); }, [raised, settleTo]);
  const snap = useCallback((velocity = 0) => {
    // List momentum must never open the month before the finger reaches its top.
    const next = value.current >= 1 || sheetStop(value.current, velocity);
    setRaised(next);
    settleTo(next);
  }, [setRaised, settleTo]);
  const begin = useCallback((y: number, fromHandle = false) => {
    const viewport = readCollapsedViewport();
    active.current = true;
    start.current.viewport = viewport;
    clearWheelTimer();
    generation.current += 1;
    settling.current = null;
    motion.progress.stopAnimation();
    const distance = Math.max(1, travel);
    const scroll = Math.min(readMaxScroll(), offsetRef.current);
    offsetRef.current = scroll;
    start.current = { y, position: value.current * distance + (fromHandle ? 0 : scroll), lastY: y, time: Date.now(), velocity: 0, dragging: false, folding: value.current < 1, viewport };
    ignoreClick.current = false;
  }, [clearWheelTimer, motion.progress, offsetRef, readCollapsedViewport, readMaxScroll, travel]);
  const move = useCallback((y: number) => {
    const gesture = start.current;
    const now = Date.now();
    const previousY = gesture.dragging ? gesture.lastY : gesture.y;
    gesture.velocity = (y - gesture.lastY) / Math.max(1, now - gesture.time);
    gesture.lastY = y; gesture.time = now;
    const dy = y - gesture.y;
    if (!gesture.dragging && Math.abs(dy) < 8) return false;
    gesture.dragging = true;
    const distance = Math.max(1, travel);
    const next = advanceCalendarWebPosition(gesture.position, previousY - y, distance, readMaxScroll(), Platform.OS === "web" ? WEB_FOLD_GAIN : 1);
    gesture.position = next;
    const parts = applyPosition(next);
    if (parts.fold < distance) gesture.folding = true;
    setInteracting(gesture.folding);
    return true;
  }, [applyPosition, readMaxScroll, travel]);
  const release = useCallback(() => {
    active.current = false;
    if (!start.current.dragging) return;
    ignoreClick.current = true;
    const distance = Math.max(1, travel);
    applyPosition(calendarDragPosition(value.current * distance + offsetRef.current, 0, distance, readMaxScroll()));
    snap(Date.now() - start.current.time < 100 ? start.current.velocity : 0);
    start.current.dragging = false;
  }, [applyPosition, offsetRef, readMaxScroll, snap, travel]);
  type Pointer = { clientY: number; pointerId: number; currentTarget: HTMLElement; preventDefault: () => void };
  const pointerHandlers = Platform.OS === "web" ? {
    onPointerDown: (event: Pointer) => { begin(event.clientY); },
    onPointerMove: (event: Pointer) => {
      if (!active.current) return;
      if (move(event.clientY)) { event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); }
    },
    onPointerUp: () => { active.current = false; release(); },
    onPointerCancel: () => { active.current = false; start.current.dragging = false; snap(); },
    onClickCapture: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (ignoreClick.current) { ignoreClick.current = false; event.preventDefault(); event.stopPropagation(); }
    },
  } : {};
  type HandlePointer = Pointer & { stopPropagation: () => void };
  const handlePointerHandlers = Platform.OS === "web" ? {
    onPointerDown: (event: HandlePointer) => { event.stopPropagation(); begin(event.clientY, true); event.currentTarget.setPointerCapture(event.pointerId); },
    onPointerMove: (event: HandlePointer) => { event.stopPropagation(); pointerHandlers.onPointerMove!(event); },
    onPointerUp: (event: HandlePointer) => { event.stopPropagation(); active.current = false; release(); },
    onPointerCancel: (event: HandlePointer) => { event.stopPropagation(); active.current = false; start.current.dragging = false; snap(); },
  } : {};
  const claimNativeDrag = useCallback((dy: number, dx: number) => Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) && (!raised || offsetRef.current <= 0 && dy > 0), [raised, offsetRef]);
  // PanResponder stores these handlers; it does not invoke gesture callbacks during render.
  // eslint-disable-next-line react-hooks/refs
  const native = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => claimNativeDrag(g.dy, g.dx),
    onPanResponderGrant: (_, g) => begin(g.y0),
    onPanResponderMove: (_, g) => { move(g.moveY); },
    onPanResponderRelease: release,
    onPanResponderTerminate: () => { active.current = false; start.current.dragging = false; snap(); },
  }), [begin, claimNativeDrag, move, release, snap]);
  const wheel = useCallback((event: WheelEvent) => {
    if (event.defaultPrevented || event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || event.cancelable === false) return;
    const distance = Math.max(1, travel);
    const pageHeight = (event.currentTarget as HTMLElement | null)?.clientHeight || distance;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageHeight : 1);
    const maxScroll = readMaxScroll();
    const current = value.current * distance + Math.max(0, Math.min(maxScroll, offsetRef.current));
    if (current <= 0 && delta < 0) return;
    // One owner applies both parts of the delta, including over the grid where
    // browser-default scrolling cannot reach the sibling events list.
    event.preventDefault();
    if (active.current) return;
    clearWheelTimer();
    const request = ++generation.current;
    settling.current = null;
    motion.progress.stopAnimation();
    const next = advanceCalendarWebPosition(current, delta, distance, maxScroll, WEB_FOLD_GAIN);
    const parts = applyPosition(next);
    setInteracting(parts.fold > 0 && parts.fold < distance);
    if (parts.fold === 0 || parts.fold === distance) {
      setRaised(parts.fold === distance);
      settleTo(parts.fold === distance);
    } else {
      wheelTimer.current = setTimeout(() => {
        wheelTimer.current = null;
        if (request === generation.current && !active.current) snap();
      }, WHEEL_IDLE_MS);
    }
  }, [applyPosition, clearWheelTimer, motion.progress, offsetRef, readMaxScroll, setRaised, settleTo, snap, travel]);
  return { ...motion, onListLayout, onListContentSizeChange, onListScroll, consumeDragClick: () => { const consumed = ignoreClick.current; ignoreClick.current = false; return consumed; }, nativeMotion, interacting: nativeMotion?.interacting ?? interacting, handlePointerHandlers, pointerHandlers: pointerHandlers as object, wheel, panHandlers: Platform.OS === "web" ? {} : native.panHandlers };
}
