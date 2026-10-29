import { useRef, type ReactNode, type RefObject } from "react";
import { Platform, ScrollView, View } from "react-native";
import { CalendarFoldHandle } from "./CalendarFold";
import { useCalendarWheel, type useEventSheetGesture } from "./useEventSheetGesture";
import { NativeCalendarEvents } from "./NativeCalendarEvents";

/** Events stay in the page flow while the shared gesture folds the month above them. */
export function CalendarEventSheet({ mobile, collapsed, onCollapsedChange, motion, listRef, header, footer, children }: {
  mobile: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  motion: ReturnType<typeof useEventSheetGesture>;
  listRef: RefObject<ScrollView | null>;
  offsetRef: RefObject<number>;
  header: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const sheetRef = useRef<View>(null);
  useCalendarWheel(sheetRef, motion.wheel);
  if (mobile && motion.nativeMotion) return <NativeCalendarEvents motion={motion.nativeMotion} header={header} footer={footer}
    handle={<CalendarFoldHandle collapsed={!collapsed} onChange={value => onCollapsedChange(!value)} panHandlers={{}} expandLabel="Recolher calendário" collapseLabel="Expandir calendário" />}>
    {children}
  </NativeCalendarEvents>;
  return <View style={{ flex: 1, minHeight: 0, width: "100%" }}>
    <View
    ref={sheetRef}
    {...(mobile ? { ...motion.panHandlers, ...motion.pointerHandlers } : {})}
    testID="calendar-event-sheet"
    style={{ gap: 6, width: "100%", flex: 1, minHeight: 0, paddingHorizontal: 4, ...(mobile && Platform.OS === "web" ? { touchAction: "none" } as object : {}) }}>
    {mobile ? <CalendarFoldHandle collapsed={!collapsed} onChange={value => onCollapsedChange(!value)} panHandlers={{}} mouseHandlers={motion.handlePointerHandlers} consumeDragClick={motion.consumeDragClick} expandLabel="Recolher calendário" collapseLabel="Expandir calendário" /> : null}
    {header}
    <ScrollView ref={listRef} testID="calendar-event-list" nestedScrollEnabled
      scrollEnabled={!mobile || collapsed}
      onLayout={motion.onListLayout} onContentSizeChange={motion.onListContentSizeChange}
      onScroll={motion.onListScroll} scrollEventThrottle={16}
      style={{ flex: 1, minHeight: 0, ...(Platform.OS === "web" ? { scrollbarGutter: "stable", scrollbarWidth: "thin" } as object : {}) }}
      contentContainerStyle={{ paddingBottom: 12 }}>
      {children}
    </ScrollView>
    </View>
    {footer}
  </View>;
}
