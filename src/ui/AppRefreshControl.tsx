import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRefreshFeedback } from "./RefreshFeedbackProvider";
import { useAppTheme } from "./app-theme";
import { requestPendingEditsNavigation } from "../navigation/pending-edits-navigation";
import {
  Platform,
  RefreshControl,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
  type ScrollViewProps,
} from "react-native";

type AppRefreshControlProps = RefreshControlProps & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppRefreshControl(props: AppRefreshControlProps) {
  const { colors: themeColors } = useAppTheme();
  const {
    children,
    enabled = true,
    onRefresh,
    refreshing,
    style,
    tintColor,
    ...nativeProps
  } = props;
  const scrollOffset = useRef(0);
  // Android's native control owns the full pull/release animation. Publishing
  // the same gesture to the root overlay duplicates it, and hiding the native
  // indicator makes the pull disappear when Android intercepts touch events.
  const globalFeedback = useRefreshFeedback();
  const feedback = Platform.OS === "android" ? null : globalFeedback;
  const feedbackId = useId();
  const touchOrigin = useRef({ x: 0, y: 0 });
  const pullDistance = useRef(0);
  useEffect(() => {
    globalFeedback?.(feedbackId, refreshing ? { refreshing: true, pull: 0 } : null);
    return () => globalFeedback?.(feedbackId, null);
  }, [globalFeedback, feedbackId, refreshing]);
  const eligibleGesture = useRef(true);
  const [gestureEnabled, setGestureEnabled] = useState(true);
  // Android wraps the native scroll view inside this control. Keep a gesture
  // that started below the top from becoming a refresh when it reaches the top.
  const guardedChildren = Platform.OS === "android" && isValidElement<ScrollViewProps>(children)
    // eslint-disable-next-line react-hooks/refs -- cloneElement stores event handlers; ref reads below run only during native events, not rendering.
    ? cloneElement(children, {
        scrollEventThrottle: Math.min(children.props.scrollEventThrottle || 16, 16),
        onScroll: (event) => {
          scrollOffset.current = event.nativeEvent.contentOffset.y;
          if (scrollOffset.current > 1) {
            eligibleGesture.current = false;
            setGestureEnabled(false);
          }
          children.props.onScroll?.(event);
        },
        onTouchStart: (event) => {
          pullDistance.current = 0;
          touchOrigin.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
          eligibleGesture.current = scrollOffset.current <= 1;
          setGestureEnabled(eligibleGesture.current);
          children.props.onTouchStart?.(event);
        },
        onTouchMove: (event) => {
          const dx = event.nativeEvent.pageX - touchOrigin.current.x;
          const dy = event.nativeEvent.pageY - touchOrigin.current.y;
          if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
            eligibleGesture.current = false;
            setGestureEnabled(false);
          }
          pullDistance.current = enabled && !refreshing && eligibleGesture.current && dy > Math.abs(dx) * 1.5 ? Math.max(0, dy) : 0;
          if (!refreshing) feedback?.(feedbackId, enabled && eligibleGesture.current && dy > 0 ? { refreshing: false, pull: Math.min(dy, 100) } : null);
          children.props.onTouchMove?.(event);
        },
        onTouchCancel: (event) => {
          pullDistance.current = 0;
          setGestureEnabled(scrollOffset.current <= 1);
          if (!refreshing) feedback?.(feedbackId, null);
          children.props.onTouchCancel?.(event);
        },
      })
    : children;

  if (Platform.OS !== "web") {
    return (
      <RefreshControl
        colors={[tintColor ?? themeColors.text]}
        progressBackgroundColor={themeColors.card}
        {...nativeProps}
        enabled={enabled && (Platform.OS !== "android" || gestureEnabled)}
        onRefresh={() => {
          if (!enabled || refreshing || (Platform.OS === "android" && !eligibleGesture.current)) return;
          requestPendingEditsNavigation(() => onRefresh?.(), "refresh");
        }}
        refreshing={refreshing}
        style={style}
        tintColor={tintColor ?? themeColors.text}
      >
        {guardedChildren}
      </RefreshControl>
    );
  }

  return <>{children}</>;
}
