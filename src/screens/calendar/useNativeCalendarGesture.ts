import type { NativeCalendarMotion } from "./calendar-native-types";
export type { NativeCalendarMotion } from "./calendar-native-types";

/** Native implementation uses the already installed UI-thread gesture runtime. */
export function useNativeCalendarGesture(_collapsed: boolean, _onChange: (value: boolean) => void, _travel: number): NativeCalendarMotion | null {
  return null;
}
