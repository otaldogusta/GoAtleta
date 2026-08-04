import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useAppTheme } from "./app-theme";
import {
  resolveWebPullDistance,
  shouldTriggerWebRefresh,
  WEB_PULL_REFRESH_THRESHOLD,
} from "./web-pull-to-refresh";

type AppRefreshControlProps = RefreshControlProps & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const INTERACTIVE_SELECTOR =
  "input, textarea, select, button, [contenteditable='true'], [role='textbox']";

const findVerticalScroller = (target: Element, boundary: HTMLElement) => {
  let current: Element | null = target;

  while (current && current !== boundary.parentElement) {
    if (current instanceof HTMLElement) {
      const style = window.getComputedStyle(current);
      const scrollsVertically = /(auto|scroll)/.test(style.overflowY);
      if (
        scrollsVertically &&
        current.scrollHeight > current.clientHeight + 1
      ) {
        return current;
      }
    }
    if (current === boundary) break;
    current = current.parentElement;
  }

  return boundary.querySelector<HTMLElement>(
    "[data-goatleta-pull-scroll='true']",
  );
};

export function AppRefreshControl(props: AppRefreshControlProps) {
  const {
    children,
    enabled = true,
    onRefresh,
    refreshing,
    style,
    tintColor,
    ...nativeProps
  } = props;

  if (Platform.OS !== "web") {
    return (
      <RefreshControl
        {...nativeProps}
        enabled={enabled}
        onRefresh={onRefresh}
        refreshing={refreshing}
        style={style}
        tintColor={tintColor}
      />
    );
  }

  return (
    <WebRefreshControl
      enabled={enabled}
      onRefresh={onRefresh}
      refreshing={refreshing}
      style={style}
      tintColor={tintColor}
    >
      {children}
    </WebRefreshControl>
  );
}

type WebRefreshControlProps = Pick<
  AppRefreshControlProps,
  "children" | "enabled" | "onRefresh" | "refreshing" | "style" | "tintColor"
>;

function WebRefreshControl({
  children,
  enabled = true,
  onRefresh,
  refreshing,
  style,
  tintColor,
}: WebRefreshControlProps) {
  const { colors } = useAppTheme();
  const containerRef = useRef<View>(null);
  const gestureRef = useRef({
    tracking: false,
    startX: 0,
    startY: 0,
    distance: 0,
    scroller: null as HTMLElement | null,
  });
  const [distance, setDistance] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const active = Boolean(refreshing || requesting);

  const resetGesture = useCallback(() => {
    gestureRef.current.tracking = false;
    gestureRef.current.distance = 0;
    gestureRef.current.scroller = null;
    setDistance(0);
  }, []);

  const runRefresh = useCallback(async () => {
    if (active || !enabled || !onRefresh) return;
    setRequesting(true);
    try {
      await onRefresh();
    } finally {
      setRequesting(false);
    }
  }, [active, enabled, onRefresh]);

  useEffect(() => {
    if (!enabled || !onRefresh) return;

    const container = containerRef.current as unknown as HTMLElement | null;
    if (!container) return;

    const onTouchStart = (event: TouchEvent) => {
      if (active || event.touches.length !== 1) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(INTERACTIVE_SELECTOR)) return;
      if (
        document.querySelector("[aria-modal='true'], [role='dialog']") ||
        document.body.style.position === "fixed"
      ) {
        return;
      }

      const scroller = findVerticalScroller(target, container);
      if (scroller && scroller.scrollTop > 1) return;

      const touch = event.touches[0];
      gestureRef.current = {
        tracking: true,
        startX: touch.clientX,
        startY: touch.clientY,
        distance: 0,
        scroller,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      if (!gesture.tracking || event.touches.length !== 1) return;
      if (gesture.scroller && gesture.scroller.scrollTop > 1) {
        resetGesture();
        return;
      }

      const touch = event.touches[0];
      const nextDistance = resolveWebPullDistance({
        deltaX: touch.clientX - gesture.startX,
        deltaY: touch.clientY - gesture.startY,
      });

      if (nextDistance <= 0) {
        resetGesture();
        return;
      }

      event.preventDefault();
      gesture.distance = nextDistance;
      setDistance(nextDistance);
    };

    const onTouchEnd = () => {
      const shouldRefresh = shouldTriggerWebRefresh(
        gestureRef.current.distance,
      );
      resetGesture();
      if (shouldRefresh) void runRefresh();
    };

    container.addEventListener("touchstart", onTouchStart, {
      passive: true,
      capture: true,
    });
    container.addEventListener("touchmove", onTouchMove, {
      passive: false,
      capture: true,
    });
    container.addEventListener("touchend", onTouchEnd, { capture: true });
    container.addEventListener("touchcancel", resetGesture, { capture: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart, true);
      container.removeEventListener("touchmove", onTouchMove, true);
      container.removeEventListener("touchend", onTouchEnd, true);
      container.removeEventListener("touchcancel", resetGesture, true);
    };
  }, [active, enabled, onRefresh, resetGesture, runRefresh]);

  const ready = distance >= WEB_PULL_REFRESH_THRESHOLD;
  const visible = active || distance > 0;
  const label = active
    ? "Atualizando"
    : ready
      ? "Solte para atualizar"
      : "Puxe para atualizar";
  const indicatorColor = tintColor ?? colors.primary;

  return (
    <View
      ref={containerRef}
      style={[
        style,
        Platform.OS === "web"
          ? ({ overscrollBehaviorY: "contain" } as ViewStyle)
          : null,
      ]}
    >
      <View
        accessibilityLabel={label}
        accessibilityLiveRegion="polite"
        pointerEvents="none"
        style={
          {
            position: "fixed",
            top: 10,
            left: 0,
            right: 0,
            zIndex: 14000,
            opacity: visible ? 1 : 0,
            transform: [
              { translateY: active ? 0 : Math.max(-34, distance - 58) },
            ],
            transition: "opacity 140ms ease, transform 160ms ease",
            alignItems: "center",
          } as unknown as ViewStyle
        }
      >
        <ActivityIndicator
          animating={visible}
          color={indicatorColor}
          size="small"
        />
      </View>
      {children}
    </View>
  );
}
