import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import type { GestureResponderEvent } from "react-native";

export const HORIZONTAL_GESTURE_THRESHOLD = 6;
const GESTURE_DOMINANCE_RATIO = 1.2;

type GestureAxis = "horizontal" | "vertical" | null;

export function resolveDominantGestureAxis(
  deltaX: number,
  deltaY: number,
  threshold = HORIZONTAL_GESTURE_THRESHOLD
): GestureAxis {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (Math.max(horizontalDistance, verticalDistance) < threshold) return null;
  if (horizontalDistance >= verticalDistance * GESTURE_DOMINANCE_RATIO) {
    return "horizontal";
  }
  if (verticalDistance >= horizontalDistance * GESTURE_DOMINANCE_RATIO) {
    return "vertical";
  }
  return null;
}

export function createHorizontalGestureArbitrator(
  onHorizontalGestureChange?: (active: boolean) => void
) {
  let startPoint: { x: number; y: number } | null = null;
  let resolvedAxis: GestureAxis = null;
  let horizontalGestureActive = false;

  const setHorizontalGestureActive = (active: boolean) => {
    if (horizontalGestureActive === active) return;
    horizontalGestureActive = active;
    onHorizontalGestureChange?.(active);
  };

  const reset = () => {
    setHorizontalGestureActive(false);
    startPoint = null;
    resolvedAxis = null;
  };

  return {
    setOnChange(callback?: (active: boolean) => void) {
      onHorizontalGestureChange = callback;
    },
    start(x: number, y: number) {
      reset();
      startPoint = { x, y };
    },
    move(x: number, y: number) {
      if (!startPoint || resolvedAxis) return resolvedAxis;

      resolvedAxis = resolveDominantGestureAxis(
        x - startPoint.x,
        y - startPoint.y
      );
      if (resolvedAxis === "horizontal") {
        setHorizontalGestureActive(true);
      }
      return resolvedAxis;
    },
    end: reset,
    cancel: reset,
  };
}

export function useHorizontalGestureArbitration(
  onHorizontalGestureChange?: (active: boolean) => void
) {
  const [arbitrator] = useState(() => createHorizontalGestureArbitrator());
  useLayoutEffect(() => {
    arbitrator.setOnChange(onHorizontalGestureChange);
  }, [arbitrator, onHorizontalGestureChange]);

  const onTouchStart = useCallback((event: GestureResponderEvent) => {
    arbitrator.start(
      event.nativeEvent.pageX,
      event.nativeEvent.pageY
    );
  }, [arbitrator]);
  const onTouchMove = useCallback((event: GestureResponderEvent) => {
    arbitrator.move(
      event.nativeEvent.pageX,
      event.nativeEvent.pageY
    );
  }, [arbitrator]);
  const onTouchEnd = useCallback(() => {
    arbitrator.end();
  }, [arbitrator]);
  const onTouchCancel = useCallback(() => {
    arbitrator.cancel();
  }, [arbitrator]);

  return useMemo(
    () => ({ onTouchStart, onTouchMove, onTouchEnd, onTouchCancel }),
    [onTouchCancel, onTouchEnd, onTouchMove, onTouchStart]
  );
}
