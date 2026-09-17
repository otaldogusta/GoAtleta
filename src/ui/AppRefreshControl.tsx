import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRefreshFeedback } from "./RefreshFeedbackProvider";
import { requestPendingEditsNavigation } from "../navigation/pending-edits-navigation";
import {
  Platform,
  RefreshControl,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
  type ScrollViewProps,
  type GestureResponderEvent,
} from "react-native";

type AppRefreshControlProps = RefreshControlProps & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
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
  const scrollOffset = useRef(0);
  // Android's native control owns the full pull/release animation. Publishing
  // the same gesture to the root overlay duplicates it, and hiding the native
  // indicator makes the pull disappear when Android intercepts touch events.
  const globalFeedback = useRefreshFeedback();
  const feedback = globalFeedback;
  const feedbackId = useId();
  const touchOrigin = useRef({ x: 0, y: 0 });
  const pullDistance = useRef(0);
  useEffect(() => {
    globalFeedback?.(feedbackId, refreshing ? { refreshing: true, pull: 0 } : null);
    return () => globalFeedback?.(feedbackId, null);
  }, [globalFeedback, feedbackId, refreshing]);
  const eligibleGesture = useRef(true);
  const [gestureEnabled, setGestureEnabled] = useState(true);
  const updatePull = (event: GestureResponderEvent) => {
    const dx = event.nativeEvent.pageX - touchOrigin.current.x;
    const dy = event.nativeEvent.pageY - touchOrigin.current.y;
    pullDistance.current = enabled && !refreshing && eligibleGesture.current && dy > Math.abs(dx) * 1.5 ? Math.max(0, dy) : 0;
    if (!refreshing) feedback?.(feedbackId, pullDistance.current > 0
      ? { refreshing: false, pull: Math.min(pullDistance.current, 100) } : null);
  };
  const releasePull = () => {
    const shouldRefresh = enabled && !refreshing && eligibleGesture.current && pullDistance.current >= 96;
    pullDistance.current = 0;
    if (!refreshing) feedback?.(feedbackId, null);
    if (shouldRefresh) requestPendingEditsNavigation(() => onRefresh?.(), "refresh");
  };

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
        onTouchEnd: (event) => {
          const shouldRefresh = Boolean(globalFeedback) && enabled && !refreshing && eligibleGesture.current && pullDistance.current >= 96;
          pullDistance.current = 0;
          setGestureEnabled(scrollOffset.current <= 1);
          if (!refreshing) feedback?.(feedbackId, null);
          if (shouldRefresh) requestPendingEditsNavigation(() => onRefresh?.(), "refresh");
          children.props.onTouchEnd?.(event);
        },
        onTouchCancel: (event) => {
          pullDistance.current = 0;
          setGestureEnabled(scrollOffset.current <= 1);
          if (!refreshing) feedback?.(feedbackId, null);
          children.props.onTouchCancel?.(event);
        },
      })
    : children;

  if (Platform.OS === "android" && globalFeedback) {
    return (
      <View style={[style, { flex: 1 }]} testID={props.testID}
        onStartShouldSetResponderCapture={(event) => {
          touchOrigin.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
          eligibleGesture.current = scrollOffset.current <= 1;
          pullDistance.current = 0;
          return false;
        }}
        onMoveShouldSetResponderCapture={(event) => {
          const dx = event.nativeEvent.pageX - touchOrigin.current.x;
          const dy = event.nativeEvent.pageY - touchOrigin.current.y;
          if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) eligibleGesture.current = false;
          return enabled && !refreshing && eligibleGesture.current && dy > 12 && dy > Math.abs(dx) * 1.5;
        }}
        onResponderGrant={updatePull}
        onResponderMove={updatePull}
        onResponderRelease={releasePull}
        onResponderTerminationRequest={() => false}
        onResponderTerminate={() => {
          pullDistance.current = 0;
          if (!refreshing) feedback?.(feedbackId, null);
        }}
      >
        {guardedChildren}
      </View>
    );
  }

  if (Platform.OS !== "web") {
    return (
      <RefreshControl
        {...nativeProps}
        enabled={enabled && (Platform.OS !== "android" || gestureEnabled)}
        onRefresh={() => {
          if (!enabled || refreshing || (Platform.OS === "android" && !eligibleGesture.current)) return;
          requestPendingEditsNavigation(() => onRefresh?.(), "refresh");
        }}
        refreshing={refreshing}
        style={style}
        tintColor={tintColor}
      >
        {guardedChildren}
      </RefreshControl>
    );
  }

  return <>{children}</>;
}
