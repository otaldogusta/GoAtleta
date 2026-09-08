import { useCallback, useRef, useState } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

const BOTTOM_THRESHOLD = 64;
export function useConversationScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const metrics = useRef({ height: 0, viewport: 0, offset: 0 });
  const following = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const sync = useCallback(() => {
    const { height, viewport, offset } = metrics.current;
    setShowLatest(viewport > 0 && height - viewport - offset > BOTTOM_THRESHOLD);
  }, []);
  const scrollToLatest = useCallback((animated = true) => {
    following.current = true;
    scrollRef.current?.scrollToEnd({ animated });
  }, []);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentSize, layoutMeasurement, contentOffset } = event.nativeEvent;
    metrics.current = { height: contentSize.height, viewport: layoutMeasurement.height, offset: Math.max(0, contentOffset.y) };
    following.current = contentSize.height - layoutMeasurement.height - contentOffset.y <= BOTTOM_THRESHOLD;
    sync();
  }, [sync]);
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    metrics.current.height = height;
    if (following.current) scrollToLatest(false);
    sync();
  }, [scrollToLatest, sync]);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    metrics.current.viewport = event.nativeEvent.layout.height;
    if (following.current) scrollToLatest(false);
    sync();
  }, [scrollToLatest, sync]);
  return { scrollRef, showLatest, scrollToLatest, onScroll, onContentSizeChange, onLayout };
}
