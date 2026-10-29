import type { ReactNode } from "react";
import type { ScrollView } from "react-native";
import type { Gesture } from "react-native-gesture-handler";
import type { AnimatedRef, SharedValue } from "react-native-reanimated";

export type NativeCalendarMotion = {
  position: SharedValue<number>;
  travel: number;
  gesture: ReturnType<typeof Gesture.Pan>;
  list: AnimatedRef<ScrollView>;
  contentHeight: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  interacting: boolean;
};

export type NativeCalendarFoldProps = {
  rows: ReactNode[];
  selectedRow: number;
  rowHeight: number;
  motion: NativeCalendarMotion;
  onWeekChange?: (index: number) => void;
  weekActive?: boolean;
};

export type NativeCalendarEventsProps = {
  motion: NativeCalendarMotion;
  handle: ReactNode;
  header: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
};
