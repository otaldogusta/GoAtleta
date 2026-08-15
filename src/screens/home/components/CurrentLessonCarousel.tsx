import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  type LayoutChangeEvent,
  PanResponder,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  View,
} from "react-native";

import { spacing } from "../../../theme/tokens";
import { CurrentLessonHero } from "./CurrentLessonHero";
import type { HomeScheduleItem, HomeScheduleSlot } from "./homeScheduleTypes";

type CurrentLessonCarouselProps = {
  slots: HomeScheduleSlot[];
  currentIndex: number;
  selectedDateLabel: string;
  todayDateKey: string;
  nowTime: number;
  compact?: boolean;
  mobile?: boolean;
  onIndexChange: (index: number) => void;
  onOpenLesson: (item: HomeScheduleItem | null) => void;
  onOpenAttendance: (item: HomeScheduleItem | null) => void;
};

type ResolveCarouselIndexParams = {
  currentIndex: number;
  dragDistance: number;
  velocityX: number;
  totalSlots: number;
};

const DRAG_THRESHOLD = 36;
const VELOCITY_THRESHOLD = 0.3;

export function resolveCarouselIndex({
  currentIndex,
  dragDistance,
  velocityX,
  totalSlots,
}: ResolveCarouselIndexParams) {
  if (totalSlots <= 0) return 0;

  const direction =
    dragDistance <= -DRAG_THRESHOLD || velocityX <= -VELOCITY_THRESHOLD
      ? 1
      : dragDistance >= DRAG_THRESHOLD || velocityX >= VELOCITY_THRESHOLD
        ? -1
        : 0;

  return Math.max(0, Math.min(totalSlots - 1, currentIndex + direction));
}

export function resolveKeyboardCarouselIndex(
  key: string,
  currentIndex: number,
  totalSlots: number
) {
  if (key === "ArrowLeft") {
    return Math.max(0, currentIndex - 1);
  }
  if (key === "ArrowRight") {
    return Math.min(Math.max(0, totalSlots - 1), currentIndex + 1);
  }
  return currentIndex;
}

export function shouldAnimateCarouselSync(
  previousIndex: number | null,
  currentIndex: number
) {
  return previousIndex !== null && previousIndex !== currentIndex;
}

export const CurrentLessonCarousel = memo(function CurrentLessonCarousel({
  slots,
  currentIndex,
  selectedDateLabel,
  todayDateKey,
  nowTime,
  compact = false,
  mobile = false,
  onIndexChange,
  onOpenLesson,
  onOpenAttendance,
}: CurrentLessonCarouselProps) {
  const listRef = useRef<FlatList<HomeScheduleSlot>>(null);
  const currentOffsetRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const pendingAnimatedIndexRef = useRef<number | null>(null);
  const lastSyncedIndexRef = useRef<number | null>(null);
  const [carouselWidth, setCarouselWidth] = useState(0);

  const scrollToIndex = useCallback(
    (nextIndex: number, animated: boolean) => {
      if (!carouselWidth || !slots.length) return;
      const boundedIndex = Math.max(0, Math.min(slots.length - 1, nextIndex));
      const nextOffset = boundedIndex * carouselWidth;
      currentOffsetRef.current = nextOffset;
      listRef.current?.scrollToOffset({ offset: nextOffset, animated });
    },
    [carouselWidth, slots.length]
  );

  const settleAtIndex = useCallback(
    (nextIndex: number) => {
      pendingAnimatedIndexRef.current =
        nextIndex === currentIndex ? null : nextIndex;
      scrollToIndex(nextIndex, true);
      if (nextIndex !== currentIndex) onIndexChange(nextIndex);
    },
    [currentIndex, onIndexChange, scrollToIndex]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          slots.length > 1 &&
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          dragStartOffsetRef.current = currentIndex * carouselWidth;
        },
        onPanResponderMove: (_, gesture) => {
          if (!carouselWidth || !slots.length) return;
          const maxOffset = Math.max(0, (slots.length - 1) * carouselWidth);
          const nextOffset = Math.max(
            0,
            Math.min(maxOffset, dragStartOffsetRef.current - gesture.dx)
          );
          currentOffsetRef.current = nextOffset;
          listRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
        },
        onPanResponderRelease: (_, gesture) => {
          settleAtIndex(
            resolveCarouselIndex({
              currentIndex,
              dragDistance: gesture.dx,
              velocityX: gesture.vx,
              totalSlots: slots.length,
            })
          );
        },
        onPanResponderTerminate: () => {
          scrollToIndex(currentIndex, true);
        },
      }),
    [carouselWidth, currentIndex, scrollToIndex, settleAtIndex, slots.length]
  );

  useEffect(() => {
    if (!carouselWidth) return;
    if (pendingAnimatedIndexRef.current === currentIndex) {
      pendingAnimatedIndexRef.current = null;
      lastSyncedIndexRef.current = currentIndex;
      return;
    }
    scrollToIndex(
      currentIndex,
      shouldAnimateCarouselSync(lastSyncedIndexRef.current, currentIndex)
    );
    lastSyncedIndexRef.current = currentIndex;
  }, [carouselWidth, currentIndex, scrollToIndex]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setCarouselWidth((previousWidth) =>
      previousWidth === nextWidth ? previousWidth : nextWidth
    );
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      currentOffsetRef.current = event.nativeEvent.contentOffset.x;
    },
    []
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!carouselWidth || !slots.length) return;
      const nextIndex = Math.max(
        0,
        Math.min(
          slots.length - 1,
          Math.round(event.nativeEvent.contentOffset.x / carouselWidth)
        )
      );
      if (nextIndex !== currentIndex) onIndexChange(nextIndex);
    },
    [carouselWidth, currentIndex, onIndexChange, slots.length]
  );

  const handleKeyDown = useCallback(
    (event: { key: string; preventDefault: () => void }) => {
      const nextIndex = resolveKeyboardCarouselIndex(
        event.key,
        currentIndex,
        slots.length
      );
      if (nextIndex === currentIndex) return;
      event.preventDefault();
      settleAtIndex(nextIndex);
    },
    [currentIndex, settleAtIndex, slots.length]
  );

  if (!slots.length) {
    return (
      <CurrentLessonHero
        slot={null}
        selectedDateLabel={selectedDateLabel}
        isToday={false}
        compact={compact}
        mobile={mobile}
        onOpenLesson={() => onOpenLesson(null)}
        onOpenAttendance={() => onOpenAttendance(null)}
      />
    );
  }

  const carousel = (
    <View
      {...panResponder.panHandlers}
      onLayout={handleLayout}
      style={{ width: "100%", overflow: "hidden" }}
    >
      <FlatList
        ref={listRef}
        horizontal
        data={slots}
        keyExtractor={(slot) => slot.key}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        getItemLayout={
          carouselWidth
            ? (_, index) => ({
                length: carouselWidth,
                offset: carouselWidth * index,
                index,
              })
            : undefined
        }
        renderItem={({ item: slot, index }) => {
          const primaryItem = slot.items[0] ?? null;
          const isToday = Boolean(
            primaryItem?.dateKey === todayDateKey &&
              slot.startTime <= nowTime &&
              slot.endTime > nowTime
          );

          return (
            <View
              accessibilityElementsHidden={index !== currentIndex}
              importantForAccessibility={
                index === currentIndex ? "auto" : "no-hide-descendants"
              }
              style={{
                width: carouselWidth || "100%",
                paddingHorizontal: spacing.xs / 2,
              }}
            >
              <CurrentLessonHero
                slot={slot}
                selectedDateLabel={selectedDateLabel}
                isToday={isToday}
                compact={compact}
                mobile={mobile}
                currentPosition={index}
                totalSlots={slots.length}
                onOpenLesson={() => onOpenLesson(primaryItem)}
                onOpenAttendance={() => onOpenAttendance(primaryItem)}
              />
            </View>
          );
        }}
      />
    </View>
  );

  if (Platform.OS === "web") {
    return (
      <div
        aria-label="Carrossel de próximas aulas"
        onKeyDown={handleKeyDown}
        role="region"
        tabIndex={0}
        style={{ outline: "none", width: "100%" }}
      >
        {carousel}
      </div>
    );
  }

  return carousel;
});
