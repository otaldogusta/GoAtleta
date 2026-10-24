import { type ReactNode, type RefObject } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { CalendarFoldHandle } from "./CalendarFold";
import { type useEventSheetGesture } from "./useEventSheetGesture";
import { NativeCalendarEvents } from "./NativeCalendarEvents";

/** Events stay in the page flow while the shared gesture folds the month above them. */
export function CalendarEventSheet({ mobile, collapsed, onCollapsedChange, motion, listRef, offsetRef, header, children }: {
  mobile: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  motion: ReturnType<typeof useEventSheetGesture>;
  listRef: RefObject<ScrollView | null>;
  offsetRef: RefObject<number>;
  header: ReactNode;
  children?: ReactNode;
}) {
  const { colors } = useAppTheme();
  if (mobile && motion.nativeMotion) return <NativeCalendarEvents motion={motion.nativeMotion} header={header}
    handle={<CalendarFoldHandle collapsed={!collapsed} onChange={value => onCollapsedChange(!value)} panHandlers={{}} expandLabel="Recolher calendário" collapseLabel="Expandir calendário" />}>
    {children}
  </NativeCalendarEvents>;
  return <View
    {...(mobile ? { ...motion.panHandlers, ...motion.pointerHandlers, ...(Platform.OS === "web" ? { onWheel: motion.wheel } : {}) } : {})}
    testID="calendar-event-sheet"
    style={{ gap: 12, width: "100%", ...(mobile ? { flex: 1, minHeight: 0, paddingHorizontal: 4, ...(Platform.OS === "web" ? { touchAction: "none" } as object : {}) } : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }) }}>
    {mobile ? <CalendarFoldHandle collapsed={!collapsed} onChange={value => onCollapsedChange(!value)} panHandlers={{}} mouseHandlers={motion.handlePointerHandlers} expandLabel="Recolher calendário" collapseLabel="Expandir calendário" /> : null}
    {header}
    <ScrollView ref={listRef} testID="calendar-event-list" nestedScrollEnabled
      scrollEnabled={!mobile || collapsed}
      onScroll={event => { offsetRef.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
      style={{ ...(mobile ? { flex: 1, minHeight: 0 } : { maxHeight: 480 }), ...(Platform.OS === "web" ? { scrollbarGutter: "stable", scrollbarWidth: "thin" } as object : {}) }}
      contentContainerStyle={{ paddingBottom: 24 }}>
      {children}
    </ScrollView>
  </View>;
}
