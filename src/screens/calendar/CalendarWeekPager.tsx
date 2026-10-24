import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, ScrollView, View } from "react-native";

/** Native inertia / web scroll snapping keep the compact week horizontally pageable. */
export function CalendarWeekPager({ rows, selectedRow, onChange, rowHeight = 59 }: { rows: ReactNode[]; selectedRow: number; onChange: (index: number) => void; rowHeight?: number }) {
  const scroll = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userScroll = useRef(false);
  const lastOffset = useRef(0);
  const [width, setWidth] = useState(0);
  const alignSelectedWeek = useCallback(() => {
    userScroll.current = false;
    if (timer.current) clearTimeout(timer.current);
    if (width > 0) scroll.current?.scrollTo({ x: Math.max(0, selectedRow) * width, animated: false });
  }, [selectedRow, width]);
  useEffect(alignSelectedWeek, [alignSelectedWeek]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const commitWeek = () => {
    if (!userScroll.current || !width) return;
    userScroll.current = false;
    if (timer.current) clearTimeout(timer.current);
    const index = Math.max(0, Math.min(rows.length - 1, Math.round(lastOffset.current / width)));
    if (index !== selectedRow) onChange(index);
  };
  const beginUserScroll = () => { userScroll.current = true; if (timer.current) clearTimeout(timer.current); };
  const deferCommit = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(commitWeek, 140); };
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: rowHeight, overflow: "hidden" }}>
    {width > 0 ? <ScrollView ref={scroll} onContentSizeChange={alignSelectedWeek} horizontal pagingEnabled showsHorizontalScrollIndicator={false} testID="calendar-week-pager" scrollEventThrottle={32}
      {...(Platform.OS !== "web" ? { contentOffset: { x: Math.max(0, selectedRow) * width, y: 0 } } : { onPointerDown: beginUserScroll, onWheel: beginUserScroll })}
      onScrollBeginDrag={beginUserScroll}
      onScrollEndDrag={event => { lastOffset.current = event.nativeEvent.contentOffset.x; deferCommit(); }}
      onMomentumScrollBegin={() => { if (timer.current) clearTimeout(timer.current); }}
      onMomentumScrollEnd={event => { lastOffset.current = event.nativeEvent.contentOffset.x; commitWeek(); }}
      style={{ ...(Platform.OS === "web" ? { scrollSnapType: "x mandatory", overscrollBehaviorX: "contain" } as object : {}) }}
      onScroll={event => {
        if (!userScroll.current) return;
        lastOffset.current = event.nativeEvent.contentOffset.x;
        if (Platform.OS === "web") deferCommit();
      }}>
      {rows.map((row, index) => <View key={index} {...(Platform.OS === "web" ? { inert: index !== selectedRow } : {})} accessibilityElementsHidden={index !== selectedRow} importantForAccessibility={index !== selectedRow ? "no-hide-descendants" : "auto"} style={{ width, height: rowHeight, ...(Platform.OS === "web" ? { scrollSnapAlign: "start" } as object : {}) }}>{row}</View>)}
    </ScrollView> : null}
  </View>;
}
