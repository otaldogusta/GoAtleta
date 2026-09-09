import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, useWindowDimensions } from "react-native";
import type { GestureResponderEvent, PanResponderGestureState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SIZE = 58;
const MARGIN = 16;
type Dock = { side: "left" | "right"; ratio: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function useDraggableFab(defaultBottom: number, storageKey: string) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bounds = {
    left: insets.left + MARGIN,
    right: Math.max(insets.left + MARGIN, width - insets.right - SIZE - MARGIN),
    top: insets.top + MARGIN,
    bottom: Math.max(insets.top + MARGIN, height - SIZE - (Platform.OS === "web" ? insets.bottom + MARGIN : defaultBottom)),
  };
  const initial = { x: bounds.right, y: clamp(height - defaultBottom - SIZE, bounds.top, bounds.bottom) };
  const [position] = useState(() => new Animated.ValueXY(initial));
  const current = useRef(initial);
  const start = useRef(initial);
  const dock = useRef<Dock | null>(null);
  const interacted = useRef(false);
  const suppressClickUntil = useRef(0);
  const wrapperRef = useRef<any>(null);
  const live = useRef({ bounds, height, defaultBottom });
  useLayoutEffect(() => { live.current = { bounds, height, defaultBottom }; });

  const settle = useCallback((x: number, y: number, animate = true) => {
    const b = live.current.bounds;
    const side = x + SIZE / 2 < (b.left + b.right + SIZE) / 2 ? "left" : "right";
    const target = { x: side === "left" ? b.left : b.right, y: clamp(y, b.top, b.bottom) };
    dock.current = { side, ratio: (target.y - b.top) / Math.max(1, b.bottom - b.top) };
    current.current = target;
    position.stopAnimation();
    if (animate) Animated.timing(position, { toValue: target, duration: 180, useNativeDriver: false }).start();
    else position.setValue(target);
    void AsyncStorage.setItem(storageKey, JSON.stringify(dock.current)).catch(() => undefined);
  }, [position, storageKey]);

  useEffect(() => () => position.stopAnimation(), [position]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (!active || interacted.current || !raw) return;
      try {
        const saved = JSON.parse(raw) as Dock;
        if ((saved.side !== "left" && saved.side !== "right") || !Number.isFinite(saved.ratio)) return;
        dock.current = { side: saved.side, ratio: clamp(saved.ratio, 0, 1) };
        const b = live.current.bounds;
        const target = { x: saved.side === "left" ? b.left : b.right, y: b.top + dock.current.ratio * (b.bottom - b.top) };
        current.current = target;
        position.setValue(target);
      } catch { /* An invalid saved position falls back to the default corner. */ }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [position, storageKey]);

  useEffect(() => {
    const b = live.current.bounds;
    const saved = dock.current;
    const target = {
      x: saved?.side === "left" ? b.left : b.right,
      y: saved ? b.top + saved.ratio * (b.bottom - b.top) : clamp(height - defaultBottom - SIZE, b.top, b.bottom),
    };
    position.stopAnimation();
    current.current = target;
    position.setValue(target);
  }, [width, height, defaultBottom, insets.left, insets.right, insets.top, insets.bottom, position]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = wrapperRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      interacted.current = true;
      const b = live.current.bounds;
      settle(event.key === "ArrowLeft" ? b.left : event.key === "ArrowRight" ? b.right : current.current.x,
        current.current.y + (event.key === "ArrowUp" ? -40 : event.key === "ArrowDown" ? 40 : 0));
    };
    node?.addEventListener?.("keydown", onKeyDown);
    return () => node?.removeEventListener?.("keydown", onKeyDown);
  }, [settle]);

  const onGrant = useCallback(() => {
      interacted.current = true;
      position.stopAnimation();
      start.current = current.current;
      suppressClickUntil.current = Date.now() + 60000;
    }, [position]);
  const onMove = useCallback((_: GestureResponderEvent, gesture: PanResponderGestureState) => {
      const b = live.current.bounds;
      const target = { x: clamp(start.current.x + gesture.dx, b.left, b.right), y: clamp(start.current.y + gesture.dy, b.top, b.bottom) };
      current.current = target;
      position.setValue(target);
    }, [position]);
  const onRelease = useCallback(() => {
      suppressClickUntil.current = Date.now() + 350;
      settle(current.current.x, current.current.y);
    }, [settle]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = wrapperRef.current as HTMLElement | null;
    if (!node) return;
    let origin: { x: number; y: number; id: number } | null = null;
    let dragging = false;
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      origin = { x: event.clientX, y: event.clientY, id: event.pointerId };
      dragging = false;
    };
    const move = (event: PointerEvent) => {
      if (!origin || event.pointerId !== origin.id) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (!dragging && Math.abs(dx) + Math.abs(dy) <= 8) return;
      if (!dragging) { onGrant(); dragging = true; node.setPointerCapture(event.pointerId); }
      event.preventDefault();
      onMove({} as GestureResponderEvent, { dx, dy } as PanResponderGestureState);
    };
    const up = () => {
      if (dragging) onRelease();
      origin = null;
      dragging = false;
    };
    const click = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
    };
    node.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    node.addEventListener("click", click, true);
    return () => {
      node.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      node.removeEventListener("click", click, true);
    };
  }, [onGrant, onMove, onRelease]);
  // PanResponder.create registers these handlers; it does not invoke them during render.
  /* eslint-disable react-hooks/refs */
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8,
    onPanResponderGrant: onGrant,
    onPanResponderMove: onMove,
    onPanResponderRelease: onRelease,
    onPanResponderTerminate: onRelease,
  }), [onGrant, onMove, onRelease]);
  /* eslint-enable react-hooks/refs */

  const canOpen = useCallback(() => Date.now() > suppressClickUntil.current, []);
  return { position, wrapperRef, panHandlers: Platform.OS === "web" ? {} : responder.panHandlers, canOpen };
}
