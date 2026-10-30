import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 3;
const CYCLES = 3;
const SETTLE_DELAY = 120;
const pad = (value: number) => String(value).padStart(2, "0");
const wrap = (value: number, count: number) => ((value % count) + count) % count;
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : "09:00";
type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

/** Shared by the wheels and the editor's inline disclosure. */
export function useCalendarReducedMotion() {
  const [reduced, setReduced] = useState(() => Platform.OS === "web" && typeof window !== "undefined"
    ? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true
    : true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}

function TimeWheel({ label, count, value, onChange, reduced, autoFocus, disabled }: {
  label: string; count: number; value: number; onChange: (value: number) => void;
  reduced: boolean; autoFocus: boolean; disabled: boolean;
}) {
  const { colors } = useAppTheme();
  const scroll = useRef<ScrollView>(null);
  const control = useRef<View>(null);
  const initialized = useRef(false);
  const initialValue = useRef(value);
  const currentValue = useRef(value);
  const position = useRef((count + value) * ROW_HEIGHT);
  const [offset] = useState(() => new Animated.Value((count + value) * ROW_HEIGHT));
  const dragging = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ onChange, reduced, disabled });
  useLayoutEffect(() => { latest.current = { onChange, reduced, disabled }; }, [onChange, reduced, disabled]);

  const clearSettle = useCallback(() => {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  }, []);
  useEffect(() => clearSettle, [clearSettle]);
  useEffect(() => { if (disabled) clearSettle(); }, [disabled, clearSettle]);
  useEffect(() => {
    if (Platform.OS === "web" && autoFocus && !disabled) control.current?.focus();
  }, [autoFocus, disabled]);

  const report = useCallback((index: number) => {
    const next = wrap(index, count);
    if (next === currentValue.current || latest.current.disabled) return;
    currentValue.current = next;
    latest.current.onChange(next);
  }, [count]);

  const jump = useCallback((index: number) => {
    const y = index * ROW_HEIGHT;
    position.current = y;
    offset.setValue(y);
    scroll.current?.scrollTo({ y, animated: false });
  }, [offset]);

  const finish = useCallback(() => {
    clearSettle();
    if (!initialized.current || dragging.current || latest.current.disabled) return;
    const index = Math.max(0, Math.min(count * CYCLES - 1, Math.round(position.current / ROW_HEIGHT)));
    report(index);
    if (Math.abs(position.current - index * ROW_HEIGHT) > 0.5) {
      // Align a partial stop once; recenter only after that movement finishes.
      scroll.current?.scrollTo({ y: index * ROW_HEIGHT, animated: !latest.current.reduced });
      return;
    }
    if (index < count || index >= count * 2) jump(count + wrap(index, count));
  }, [clearSettle, count, jump, report]);

  const scheduleSettle = useCallback(() => {
    clearSettle();
    if (!dragging.current) settleTimer.current = setTimeout(finish, SETTLE_DELAY);
  }, [clearSettle, finish]);

  useLayoutEffect(() => {
    if (value === currentValue.current) return;
    clearSettle();
    currentValue.current = value;
    initialValue.current = value;
    if (initialized.current) jump(count + value);
  }, [value, count, clearSettle, jump]);

  const select = useCallback((next: number) => {
    if (latest.current.disabled) return;
    clearSettle();
    const logical = wrap(next, count);
    const indexes = Array.from({ length: CYCLES }, (_, cycle) => cycle * count + logical);
    const index = indexes.reduce((nearest, candidate) => Math.abs(candidate * ROW_HEIGHT - position.current) < Math.abs(nearest * ROW_HEIGHT - position.current) ? candidate : nearest);
    report(index);
    if (latest.current.reduced) jump(index);
    else scroll.current?.scrollTo({ y: index * ROW_HEIGHT, animated: true });
  }, [clearSettle, count, jump, report]);
  const step = (direction: number) => select(currentValue.current + direction);

  const rows = useMemo(() => Array.from({ length: count * CYCLES }, (_, index) => {
    const logical = wrap(index, count);
    const primaryCycle = index >= count && index < count * 2;
    const inputRange = [-2, -1, 0, 1, 2].map(distance => (index + distance) * ROW_HEIGHT);
    return <Pressable key={index} testID={`time-row-${label}-${index}`}
      accessibilityRole="button" accessibilityLabel={primaryCycle ? `${label === "Horas" ? "Hora" : "Minuto"} ${pad(logical)}` : undefined}
      accessible={primaryCycle} accessibilityElementsHidden={!primaryCycle} importantForAccessibility={primaryCycle ? "auto" : "no-hide-descendants"}
      tabIndex={Platform.OS === "web" ? -1 : undefined} disabled={disabled}
      suppressWebHoverFeedback disableWebPressScale onPress={() => select(logical)}
      style={[styles.number, Platform.OS === "web" ? { scrollSnapAlign: "center" } as object : null]}>
      <Animated.Text style={[styles.digit, { color: colors.text,
        opacity: offset.interpolate({ inputRange, outputRange: [0.08, 0.25, 1, 0.25, 0.08], extrapolate: "clamp" }),
        transform: [{ scale: reduced ? 1 : offset.interpolate({ inputRange, outputRange: [0.76, 0.86, 1, 0.86, 0.76], extrapolate: "clamp" }) }],
      }]}>{pad(logical)}</Animated.Text>
    </Pressable>;
  }), [count, label, disabled, select, colors.text, offset, reduced]);

  const handleScroll = useCallback((event: ScrollEvent) => {
    if (!initialized.current || latest.current.disabled) return;
    position.current = event.nativeEvent.contentOffset.y;
    report(Math.round(position.current / ROW_HEIGHT));
    scheduleSettle();
  }, [report, scheduleSettle]);
  // Animated.event registers this listener; it only reads interaction refs on scroll.
  // eslint-disable-next-line react-hooks/refs
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { y: offset } } }], {
    useNativeDriver: Platform.OS !== "web", listener: handleScroll,
  }), [offset, handleScroll]);

  return <View style={styles.column}>
    <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    <View ref={control} accessible accessibilityRole="adjustable" accessibilityLabel={label}
      accessibilityState={{ disabled }} accessibilityValue={{ min: 0, max: count - 1, now: value, text: pad(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={event => { if (event.nativeEvent.actionName === "increment" || event.nativeEvent.actionName === "decrement") step(event.nativeEvent.actionName === "increment" ? 1 : -1); }}
      {...(Platform.OS === "web" ? { tabIndex: disabled ? -1 : 0, "aria-valuemin": 0, "aria-valuemax": count - 1, "aria-valuenow": value, "aria-valuetext": pad(value), onKeyDown: (event: { key: string; preventDefault: () => void }) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); step(event.key === "ArrowDown" ? 1 : -1); }
      } } : {})}>
      <Animated.ScrollView ref={scroll} testID={`time-wheel-${label}`} tabIndex={Platform.OS === "web" ? -1 : undefined}
        style={[styles.wheel, Platform.OS === "web" ? { scrollSnapType: "y mandatory", overscrollBehavior: "contain", scrollbarWidth: "none" } as object : null]}
        contentContainerStyle={styles.wheelContent} showsVerticalScrollIndicator={false} scrollEnabled={!disabled}
        snapToInterval={ROW_HEIGHT} decelerationRate="fast" disableIntervalMomentum={reduced} scrollEventThrottle={16}
        onContentSizeChange={() => { if (!initialized.current) { initialized.current = true; jump(count + initialValue.current); } }}
        onScroll={onScroll}
        onScrollBeginDrag={() => { dragging.current = true; clearSettle(); }}
        onScrollEndDrag={() => { dragging.current = false; scheduleSettle(); }}
        onMomentumScrollBegin={clearSettle}
        onMomentumScrollEnd={(event: ScrollEvent) => { if (dragging.current) return; position.current = event.nativeEvent.contentOffset.y; finish(); }}>
        {rows}
      </Animated.ScrollView>
    </View>
  </View>;
}

/** Controlled wheels for inline editing; all 60 minute values remain available. */
export function CalendarTimeWheels({ value, onChange, disabled = false, autoFocus = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; autoFocus?: boolean;
}) {
  const { colors } = useAppTheme();
  const reduced = useCalendarReducedMotion();
  const normalized = validTime(value);
  const hour = Number(normalized.slice(0, 2)), minute = Number(normalized.slice(3));
  const selection = useRef({ hour, minute });
  useLayoutEffect(() => { selection.current = { hour, minute }; }, [hour, minute]);
  const change = (part: "hour" | "minute", next: number) => {
    if (disabled) return;
    selection.current[part] = next;
    onChange(`${pad(selection.current.hour)}:${pad(selection.current.minute)}`);
  };
  return <View style={styles.picker}>
    <TimeWheel label="Horas" count={24} value={hour} onChange={next => change("hour", next)} reduced={reduced} autoFocus={autoFocus} disabled={disabled} />
    <Text accessible={false} style={[styles.colon, { color: colors.text }]}>:</Text>
    <TimeWheel label="Minutos" count={60} value={minute} onChange={next => change("minute", next)} reduced={reduced} autoFocus={false} disabled={disabled} />
  </View>;
}

/** Keep mounted while visible becomes false so ModalSheet can finish its exit. */
export function CalendarTimePicker({ value, onConfirm, onClose, visible = true }: {
  value: string; onConfirm: (value: string) => void; onClose: () => void; visible?: boolean;
}) {
  const { colors } = useAppTheme();
  const reducedMotion = useCalendarReducedMotion();
  const normalized = validTime(value);
  const [selected, setSelected] = useState(normalized);
  const selection = useRef(normalized);
  const wasVisible = useRef(visible);
  const [opening, setOpening] = useState(0);
  useLayoutEffect(() => {
    if (visible && !wasVisible.current) {
      selection.current = normalized;
      setSelected(normalized);
      setOpening(previous => previous + 1);
    }
    wasVisible.current = visible;
  }, [visible, normalized]);

  return <ModalSheet visible={visible} position="center" onClose={onClose} reduceMotion={reducedMotion}
    cardStyle={[styles.card, { backgroundColor: colors.card }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Horário</Text>
    <CalendarTimeWheels key={opening} value={selected} disabled={!visible} autoFocus={visible} onChange={next => { selection.current = next; setSelected(next); }} />
    <View style={[styles.actions, { borderColor: colors.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancelar horário" disabled={!visible} onPress={onClose} style={styles.action}><Text style={[styles.actionText, { color: colors.text }]}>Cancelar</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Confirmar horário" disabled={!visible} onPress={() => onConfirm(selection.current)} style={styles.action}><Text style={[styles.actionText, { color: colors.primaryBg }]}>Concluído</Text></Pressable>
    </View>
  </ModalSheet>;
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 320, borderRadius: 24, padding: 20, gap: 16 },
  title: { fontSize: 18, fontWeight: "700" },
  picker: { flexDirection: "row", alignItems: "flex-end" },
  column: { flex: 1, gap: 8, minWidth: 0 },
  label: { fontSize: 12, textAlign: "center", height: 16 },
  wheel: { height: ROW_HEIGHT * VISIBLE_ROWS },
  wheelContent: { paddingVertical: ROW_HEIGHT * (VISIBLE_ROWS - 1) / 2 },
  number: { height: ROW_HEIGHT, alignItems: "center", justifyContent: "center" },
  digit: { fontSize: 32, fontWeight: "500", fontVariant: ["tabular-nums"] },
  colon: { fontSize: 30, lineHeight: ROW_HEIGHT, height: ROW_HEIGHT, alignSelf: "center", marginTop: 24, width: 20, textAlign: "center" },
  actions: { flexDirection: "row", borderTopWidth: 1, paddingTop: 8 },
  action: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: 15, fontWeight: "600" },
});
