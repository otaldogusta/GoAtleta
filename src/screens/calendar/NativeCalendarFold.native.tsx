import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { NativeCalendarFoldProps } from "./calendar-native-types";
import { CalendarWeekPager } from "./CalendarWeekPager";
export function NativeCalendarFold({ rows, selectedRow, rowHeight, motion, onWeekChange, weekActive = false }: NativeCalendarFoldProps) {
  const { position, travel } = motion;
  const rowCount = rows.length;
  const hasPager = Boolean(onWeekChange);
  const height = useAnimatedStyle(() => ({ height: rowCount * rowHeight - Math.min(travel, position.value) }));
  const month = useAnimatedStyle(() => ({
    opacity: hasPager && position.value >= travel ? 0 : 1,
    transform: [{ translateY: -Math.max(0, selectedRow) * rowHeight * Math.min(1, position.value / travel) }],
  }));
  const week = useAnimatedStyle(() => ({ opacity: position.value >= travel ? 1 : 0 }));
  // Both representations keep their native views through every stop/reversal.
  // Visibility changes atomically on the UI thread; no pager remount at snap end.
  return <Animated.View testID="calendar-native-viewport" style={[{ overflow: "hidden" }, height]}>
    <Animated.View pointerEvents={weekActive ? "none" : "auto"} accessibilityElementsHidden={weekActive} importantForAccessibility={weekActive ? "no-hide-descendants" : "auto"} style={month}>
      {rows.map((row, index) => <View key={index} style={{ height: rowHeight }}>{row}</View>)}
    </Animated.View>
    {onWeekChange ? <Animated.View pointerEvents={weekActive ? "auto" : "none"} accessibilityElementsHidden={!weekActive} importantForAccessibility={!weekActive ? "no-hide-descendants" : "auto"} style={[{ position: "absolute", top: 0, left: 0, right: 0, height: rowHeight }, week]}>
      <CalendarWeekPager rows={rows} selectedRow={selectedRow} rowHeight={rowHeight} onChange={onWeekChange} />
    </Animated.View> : null}
  </Animated.View>;
}
