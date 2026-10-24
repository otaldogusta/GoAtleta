import { View } from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import type { NativeCalendarEventsProps } from "./calendar-native-types";

export function NativeCalendarEvents({ motion, handle, header, children }: NativeCalendarEventsProps) {
  const { gesture, list, contentHeight, viewportHeight, travel, position } = motion;
  return <GestureHandlerRootView style={{ flex: 1, minHeight: 0, width: "100%" }}>
    <GestureDetector gesture={gesture}>
      <View collapsable={false} testID="calendar-event-sheet" style={{ flex: 1, minHeight: 0, gap: 12, paddingHorizontal: 4 }}>
        {handle}{header}
        <Animated.ScrollView ref={list} testID="calendar-event-list" scrollEnabled={false}
          accessibilityActions={[{ name: "scrollForward", label: "Pr\u00f3ximos eventos" }, { name: "scrollBackward", label: "Eventos anteriores" }]}
          onAccessibilityAction={event => {
            const direction = event.nativeEvent.actionName === "scrollForward" ? 1 : -1;
            position.set(Math.max(travel, Math.min(travel + Math.max(0, contentHeight.get() - viewportHeight.get()), position.get() + direction * viewportHeight.get() * 0.8)));
          }}
          onContentSizeChange={(_width, height) => { contentHeight.set(height); }}
          onLayout={event => { viewportHeight.set(event.nativeEvent.layout.height + travel - Math.min(travel, position.get())); }}
          style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingBottom: 24 }}>
          {children}
        </Animated.ScrollView>
      </View>
    </GestureDetector>
  </GestureHandlerRootView>;
}
