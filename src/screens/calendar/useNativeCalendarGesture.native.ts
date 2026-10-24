import { useCallback, useEffect, useRef, useState } from "react";
import type { ScrollView } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { cancelAnimation, scrollTo, useAnimatedReaction, useAnimatedRef, useReducedMotion, useSharedValue, withDecay, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { calendarDragParts, calendarDragPosition } from "./application/calendar-drag";

/** Calendar distance and list distance have a single owner throughout each touch. */
export function useNativeCalendarGesture(collapsed: boolean, onChange: (value: boolean) => void, travel: number) {
  const position = useSharedValue(collapsed ? travel : 0);
  const initial = useSharedValue(0);
  const initialY = useSharedValue(0);
  const dragging = useSharedValue(false);
  const folding = useSharedValue(!collapsed);
  const generation = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const list = useAnimatedRef<ScrollView>();
  const reduced = useReducedMotion();
  const [interacting, setInteracting] = useState(false);
  const previous = useRef({ collapsed, travel });
  const finish = useCallback((token: number) => {
    if (generation.get() === token) setInteracting(false);
  }, [generation]);
  useEffect(() => {
    const old = previous.current;
    previous.current = { collapsed, travel };
    if (old.collapsed === collapsed && old.travel === travel) return;
    cancelAnimation(position);
    generation.set(generation.get() + 1);
    const token = generation.value;
    setInteracting(true);
    position.set(withTiming(collapsed ? travel : 0, { duration: reduced ? 0 : 180 }, finished => {
      if (finished) scheduleOnRN(finish, token);
    }));
  }, [collapsed, travel, reduced, position, generation, finish]);
  useAnimatedReaction(() => calendarDragParts(position.value, travel).scroll, offset => {
    scrollTo(list, 0, offset, false);
  }, [travel]);
  const complete = (next: boolean, token: number) => {
    if (generation.get() !== token) return;
    // A settled gesture reports state once; it must not reset a scrolled list.
    previous.current = { collapsed: next, travel };
    onChange(next);
    setInteracting(false);
  };
  const gesture = Gesture.Pan().activeOffsetY([-6, 6]).failOffsetX([-18, 18])
    .onBegin(() => {
      // Touch-down takes ownership immediately, before the activation slop.
      generation.set(generation.get() + 1);
      cancelAnimation(position);
    })
    .onStart(event => {
      cancelAnimation(position);
      dragging.value = true;
      initial.value = position.value;
      // The event panel itself moves as the month folds. Window coordinates
      // keep that layout movement out of the finger's displacement.
      initialY.value = event.absoluteY - event.translationY;
      const isFolding = position.value < travel;
      folding.value = isFolding;
      // List-only scrolling must keep the mounted week pager. Swapping it for
      // the month on every touch makes the calendar flash at start/release.
      scheduleOnRN(setInteracting, isFolding);
    })
    .onUpdate(event => {
      // viewportHeight is expressed at the collapsed stop, so layout changes
      // during the fold cannot change the drag's scroll boundary.
      const maxScroll = Math.max(0, contentHeight.value - viewportHeight.value);
      const next = calendarDragPosition(initial.value, event.absoluteY - initialY.value, travel, maxScroll);
      position.set(next);
      // Once the calendar really starts folding, keep it mounted through the
      // whole gesture (including reversals) until the settled stop is known.
      if (next < travel && !folding.value) {
        folding.value = true;
        scheduleOnRN(setInteracting, true);
      }
    })
    // Gesture builder stores this worklet; the callback does not run during render.
    // eslint-disable-next-line react-hooks/refs
    .onEnd(event => {
      dragging.value = false;
      const current = position.value;
      const token = generation.value;
      if (current < travel) {
        const next = Math.abs(event.velocityY) > 450 ? event.velocityY < 0 : current >= travel / 2;
        position.set(withTiming(next ? travel : 0, { duration: reduced ? 0 : 180 }, finished => {
          if (finished) scheduleOnRN(complete, next, token);
        }));
      } else {
        scheduleOnRN(complete, true, token);
        // Preserve momentum in the list. A fling never expands the month by
        // itself: expansion needs a finger pulling down after reaching the top.
        if (!reduced) position.set(withDecay({ velocity: -event.velocityY, deceleration: 0.998, clamp: [travel, travel + Math.max(0, contentHeight.value - viewportHeight.value)] }));
      }
    })
    // eslint-disable-next-line react-hooks/refs
    .onFinalize((_event, success) => {
      if (success || !dragging.value) return;
      dragging.value = false;
      const token = generation.value;
      if (position.value >= travel) { scheduleOnRN(complete, true, token); return; }
      const next = position.value >= travel / 2;
      position.set(withTiming(next ? travel : 0, { duration: reduced ? 0 : 180 }, finished => {
        if (finished) scheduleOnRN(complete, next, token);
      }));
    });
  return { position, travel, gesture, list, contentHeight, viewportHeight, interacting };
}
