import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

const BOTTOM_THRESHOLD = 64;
export function useConversationScroll(persistence?: { getScrollOffset: () => number | null; saveScrollOffset: (offset: number | null) => void }) {
  const [startingOffset] = useState(() => persistence?.getScrollOffset() ?? null);
  const initialOffset = useRef(startingOffset);
  const saved = useRef(persistence);
  useEffect(() => { saved.current = persistence; }, [persistence]);
  const scrollRef = useRef<ScrollView>(null);
  const metrics = useRef({ height: 0, viewport: 0, offset: 0 });
  const following = useRef(startingOffset === null);
  const [showLatest, setShowLatest] = useState(false);
  const sync = useCallback(() => {
    const { height, viewport, offset } = metrics.current;
    setShowLatest(viewport > 0 && height - viewport - offset > BOTTOM_THRESHOLD);
  }, []);
  const scrollToLatest = useCallback((animated = true) => {
    following.current = true;
    saved.current?.saveScrollOffset(null);
    scrollRef.current?.scrollToEnd({ animated });
  }, []);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentSize, layoutMeasurement, contentOffset } = event.nativeEvent;
    metrics.current = { height: contentSize.height, viewport: layoutMeasurement.height, offset: Math.max(0, contentOffset.y) };
    following.current = contentSize.height - layoutMeasurement.height - contentOffset.y <= BOTTOM_THRESHOLD;
    saved.current?.saveScrollOffset(following.current ? null : Math.max(0, contentOffset.y));
    sync();
  }, [sync]);
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    metrics.current.height = height;
    if (initialOffset.current !== null) scrollRef.current?.scrollTo({ y: initialOffset.current, animated: false });
    if (following.current) scrollToLatest(false);
    sync();
  }, [scrollToLatest, sync]);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    metrics.current.viewport = event.nativeEvent.layout.height;
    if (initialOffset.current !== null) { scrollRef.current?.scrollTo({ y: initialOffset.current, animated: false }); initialOffset.current = null; }
    if (following.current) scrollToLatest(false);
    sync();
  }, [scrollToLatest, sync]);
  return { scrollRef, showLatest, scrollToLatest, onScroll, onContentSizeChange, onLayout };
}
