import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { compactUiMetrics as metrics } from "../../theme/tokens";

type DetailMenuItem = { key: string; label: string; icon?: GoAtletaIconName; onPress: () => void; disabled?: boolean; destructive?: boolean };
export type CalendarEntryDetailAction = {
  key: string; label: string; accessibilityLabel?: string; icon: GoAtletaIconName;
  disabled?: boolean; destructive?: boolean;
} & ({ onPress: () => void; menuItems?: DetailMenuItem[] } | { menuItems: DetailMenuItem[]; onPress?: () => void });
export type CalendarEntryDetailsProps = {
  title: string;
  accentColor?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  rows: { key: string; icon: GoAtletaIconName; label?: string; value: string; onPress?: () => void; disabled?: boolean }[];
  extra?: ReactNode;
  onClose: () => void;
  actions?: CalendarEntryDetailAction[];
  disabled?: boolean;
  onTitlePress?: () => void;
  onStartDatePress?: () => void;
  onEndDatePress?: () => void;
  onStartTimePress?: () => void;
  onEndTimePress?: () => void;
  onAccentPress?: () => void;
};

/** Only read-only wrappers use this shell; the editor keeps its existing card. */
export const calendarEntryDetailsShellStyle: ViewStyle = {
  padding: 0, paddingBottom: 0, marginBottom: 0, gap: 6, minHeight: 0, flexShrink: 1,
  backgroundColor: "transparent", borderWidth: 0,
  borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
  shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0,
  ...(Platform.OS === "web" ? { backgroundImage: "none", backdropFilter: "none", WebkitBackdropFilter: "none", boxShadow: "none" } : {}),
} as ViewStyle;

function dateLabel(value: string, withYear: boolean) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("pt-BR", {
    weekday: "short", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}),
  });
}

function focusControl(view: View | null) {
  if (Platform.OS !== "web") return;
  const node = view as unknown as HTMLElement | null;
  node?.querySelector<HTMLElement>("button, [role=menuitem], [tabindex]")?.focus();
}

type MenuKeyEvent = { key: string; preventDefault: () => void; stopPropagation: () => void; stopImmediatePropagation?: () => void };

function DetailAction({ action, disabled }: { action: CalendarEntryDetailAction; disabled: boolean }) {
  const { colors } = useAppTheme();
  const anchor = useRef<View>(null), panel = useRef<View>(null);
  const itemRefs = useRef(new Map<string, View>());
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number; generation: number } | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const blocked = disabled || Boolean(action.disabled);
  const items = action.menuItems ?? [];
  const open = Boolean(layout && !blocked && items.length);
  const live = useRef({ action, blocked });
  const generation = useRef(0), mounted = useRef(true);
  if (layout && (blocked || !items.length)) setLayout(null);
  useLayoutEffect(() => { live.current = { action, blocked }; }, [action, blocked]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; }; }, []);
  useLayoutEffect(() => { if (blocked || !items.length) generation.current += 1; }, [blocked, items.length]);
  const close = (restoreFocus = false) => {
    generation.current += 1;
    setLayout(null);
    if (restoreFocus) focusControl(anchor.current);
  };
  const show = (last = false) => {
    if (live.current.blocked) return;
    if (!live.current.action.menuItems?.length) { live.current.action.onPress?.(); return; }
    const request = ++generation.current;
    const measured = (x: number, y: number, width: number, height: number) => {
      if (!mounted.current || request !== generation.current || live.current.blocked || !live.current.action.menuItems?.length) return;
      const enabled = live.current.action.menuItems.filter(item => !item.disabled);
      setActiveKey((last ? enabled.at(-1) : enabled[0])?.key ?? null);
      setLayout({ x, y, width, height, generation: request });
    };
    const node = anchor.current as unknown as HTMLElement | null;
    if (Platform.OS === "web" && node?.getBoundingClientRect) {
      const rect = node.getBoundingClientRect();
      measured(rect.left, rect.top, rect.width, rect.height);
    } else anchor.current?.measureInWindow(measured);
  };
  const keyDown = (event: MenuKeyEvent) => {
    if (!open) return;
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.(); }
      close(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
    const enabled = live.current.action.menuItems?.filter(item => !item.disabled) ?? [];
    if (!enabled.length) return;
    const index = enabled.findIndex(item => item.key === activeKey);
    const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : index < 0 ? event.key === "ArrowUp" ? enabled.length - 1 : 0
      : (index + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length;
    setActiveKey(enabled[next].key);
  };
  useLayoutEffect(() => {
    if (!open) return;
    if (activeKey) focusControl(itemRefs.current.get(activeKey) ?? null);
    else focusControl(anchor.current);
  }, [open, activeKey]);
  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof window === "undefined" || typeof document === "undefined") return;
    const handleKey = (event: KeyboardEvent) => {
      const active = document.activeElement;
      const menuNode = panel.current as unknown as HTMLElement | null;
      const triggerNode = anchor.current as unknown as HTMLElement | null;
      if (!active || (!menuNode?.contains(active) && !triggerNode?.contains(active))) return;
      // Window capture precedes AnchoredDropdown's Escape handler on document.
      keyDown(event);
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  });
  return <>
    <View ref={anchor} collapsable={false} nativeID={`calendar-entry-action-${action.key}-anchor`} style={styles.actionSlot}>
      <Pressable accessibilityRole="button" accessibilityLabel={action.accessibilityLabel ?? action.label}
        accessibilityState={{ disabled: blocked, ...(items.length ? { expanded: open } : {}) }} disabled={blocked}
        onPress={() => { if (open) close(); else show(); }} suppressWebHoverFeedback disableWebPressScale
        {...(Platform.OS === "web" && items.length ? { "aria-haspopup": "menu" as const, onKeyDown: (event: MenuKeyEvent) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(event.key === "ArrowUp"); }
        } } : {})}
        style={state => [styles.action, { opacity: blocked ? 0.55 : 1, backgroundColor: state.pressed || Boolean((state as { hovered?: boolean }).hovered) ? colors.card : "transparent" }]}>
        <GoAtletaIcon name={action.icon} size={metrics.navigation.iconSize} color={action.destructive ? colors.dangerText : colors.text} />
        <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.actionLabel, { color: action.destructive ? colors.dangerText : colors.text }]}>{action.label}</Text>
      </Pressable>
    </View>
    {items.length ? <AnchoredDropdown visible={open} layout={layout} container={null} animationStyle={{}} zIndex={4300} maxHeight={280}
      density="menu" surface="solid" nestedScrollEnabled fitContent preferredWidth={240} align="end" interactiveRefs={[anchor]}
      activeItemId={activeKey ? `calendar-entry-menu-${action.key}-${activeKey}` : undefined} onRequestClose={() => {
        // A queued dismissal from the previous opening cannot cancel a new measurement.
        if (layout?.generation === generation.current) close();
      }}>
      <View ref={panel} accessibilityRole="menu" accessibilityLabel={action.label} {...(Platform.OS === "web" ? { onKeyDown: keyDown } : {})}>
        {items.map(item => <View key={item.key} ref={node => { if (node) itemRefs.current.set(item.key, node); else itemRefs.current.delete(item.key); }} nativeID={`calendar-entry-menu-${action.key}-${item.key}`}>
          <Pressable accessibilityRole="menuitem" accessibilityLabel={item.label} accessibilityState={{ disabled: blocked || Boolean(item.disabled) }} disabled={blocked || item.disabled}
            onFocus={() => setActiveKey(item.key)}
            {...(Platform.OS === "web" ? { tabIndex: item.key === activeKey ? 0 : -1 } : {})}
            suppressWebHoverFeedback disableWebPressScale onPress={() => {
              const current = live.current.action.menuItems?.find(candidate => candidate.key === item.key);
              if (live.current.blocked || !current || current.disabled) return;
              close(); current.onPress();
            }} style={state => [styles.menuItem, { opacity: item.disabled ? 0.55 : 1, backgroundColor: state.pressed || item.key === activeKey ? colors.inputBg : "transparent" }]}>
            {item.icon ? <GoAtletaIcon name={item.icon} size={metrics.iconSize} color={item.destructive ? colors.dangerText : colors.text} /> : null}
            <Text style={[styles.menuText, { color: item.destructive ? colors.dangerText : colors.text }]}>{item.label}</Text>
          </Pressable>
        </View>)}
      </View>
    </AnchoredDropdown> : null}
  </>;
}

/** Presentation only: callers own inclusive dates, permissions and every action. */
export function CalendarEntryDetails({ title, accentColor, startDate, endDate, startTime, endTime, allDay = false, rows, extra, onClose, actions = [], disabled = false,
  onTitlePress, onStartDatePress, onEndDatePress, onStartTimePress, onEndTimePress, onAccentPress }: CalendarEntryDetailsProps) {
  const { colors } = useAppTheme();
  const accent = accentColor ?? colors.primaryBg;
  const currentYear = String(new Date().getFullYear());
  const withYear = startDate.slice(0, 4) !== endDate.slice(0, 4) || startDate.slice(0, 4) !== currentYear;
  const start = dateLabel(startDate, withYear), end = dateLabel(endDate, withYear);
  const startEditable = Boolean(onStartDatePress || (!allDay && startTime && onStartTimePress));
  const endEditable = Boolean(onEndDatePress || (!allDay && endTime && onEndTimePress));
  const supportedActions = actions.filter(action => Boolean(action.onPress || action.menuItems?.length));
  return <>
    <View style={styles.backBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar à agenda" onPress={onClose} disabled={disabled} suppressWebHoverFeedback disableWebPressScale
        style={state => [styles.back, { backgroundColor: state.pressed || Boolean((state as { hovered?: boolean }).hovered) ? colors.inputBg : "transparent" }]}>
        <GoAtletaIcon name="chevronBack" size={18} color={colors.text} />
      </Pressable>
    </View>
    <ScrollView nativeID="calendar-event-editor-scroll" keyboardShouldPersistTaps="handled" style={[styles.scroll, { backgroundColor: colors.card }]} contentContainerStyle={styles.body}>
      <View style={styles.header}>
        <View style={styles.titleSlot}>{onTitlePress ? <Pressable accessibilityRole="button" accessibilityLabel="Editar título" accessibilityValue={{ text: title }} disabled={disabled}
          suppressWebHoverFeedback disableWebPressScale onPress={onTitlePress} style={[styles.titleAction, { opacity: disabled ? 0.55 : 1 }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
        </Pressable> : <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>}</View>
        {onAccentPress ? <Pressable accessibilityRole="button" accessibilityLabel="Editar cor" disabled={disabled} onPress={onAccentPress} suppressWebHoverFeedback disableWebPressScale style={[styles.accentAction, { opacity: disabled ? 0.55 : 1 }]}>
          <View accessible={false} style={[styles.dot, { backgroundColor: accent }]} />
        </Pressable> : <View accessible={false} style={[styles.dot, { backgroundColor: accent }]} />}
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.period}>
        <View pointerEvents="none" style={styles.periodIcon}><GoAtletaIcon name="time" size={metrics.iconSize} color={colors.muted} /></View>
        <View style={styles.interval}>
          <View accessible={!startEditable} accessibilityLabel={!startEditable ? `Início: ${start}${!allDay && startTime ? `, ${startTime}` : ""}` : undefined} style={[styles.endpoint, startEditable ? styles.editableEndpoint : null]}>
            {onStartDatePress ? <Pressable accessibilityRole="button" accessibilityLabel="Editar data de início" accessibilityValue={{ text: start }} disabled={disabled} onPress={onStartDatePress} suppressWebHoverFeedback disableWebPressScale style={[styles.endpointAction, { opacity: disabled ? 0.55 : 1 }]}><Text style={[styles.date, { color: colors.text }]}>{start}</Text></Pressable> : <Text style={[styles.date, { color: colors.text }]}>{start}</Text>}
            {!allDay && startTime ? onStartTimePress ? <Pressable accessibilityRole="button" accessibilityLabel="Editar hora de início" accessibilityValue={{ text: startTime }} disabled={disabled} onPress={onStartTimePress} suppressWebHoverFeedback disableWebPressScale style={[styles.endpointAction, { opacity: disabled ? 0.55 : 1 }]}><Text style={[styles.time, { color: colors.text }]}>{startTime}</Text></Pressable> : <Text style={[styles.time, { color: colors.text }]}>{startTime}</Text> : null}
          </View>
          <GoAtletaIcon name="arrowForward" size={metrics.secondaryIconSize} color={colors.muted} />
          <View accessible={!endEditable} accessibilityLabel={!endEditable ? `Término: ${end}${!allDay && endTime ? `, ${endTime}` : ""}` : undefined} style={[styles.endpoint, endEditable ? styles.editableEndpoint : null]}>
            {onEndDatePress ? <Pressable accessibilityRole="button" accessibilityLabel="Editar data de término" accessibilityValue={{ text: end }} disabled={disabled} onPress={onEndDatePress} suppressWebHoverFeedback disableWebPressScale style={[styles.endpointAction, { opacity: disabled ? 0.55 : 1 }]}><Text style={[styles.date, { color: colors.text }]}>{end}</Text></Pressable> : <Text style={[styles.date, { color: colors.text }]}>{end}</Text>}
            {!allDay && endTime ? onEndTimePress ? <Pressable accessibilityRole="button" accessibilityLabel="Editar hora de término" accessibilityValue={{ text: endTime }} disabled={disabled} onPress={onEndTimePress} suppressWebHoverFeedback disableWebPressScale style={[styles.endpointAction, { opacity: disabled ? 0.55 : 1 }]}><Text style={[styles.time, { color: colors.text }]}>{endTime}</Text></Pressable> : <Text style={[styles.time, { color: colors.text }]}>{endTime}</Text> : null}
          </View>
        </View>
        {allDay ? <Text style={[styles.allDay, { color: colors.muted }]}>Dia todo</Text> : null}
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      {rows.filter(row => row.value.trim()).map(row => {
        const content = <><View pointerEvents="none" style={styles.rowIcon}><GoAtletaIcon name={row.icon} size={metrics.iconSize} color={colors.muted} /></View><View style={styles.rowText}><Text style={[styles.value, { color: colors.text }]}>{row.value}</Text></View></>;
        return row.onPress ? <Pressable key={row.key} accessibilityRole="button" accessibilityLabel={`Editar ${row.label ?? row.value}`} accessibilityValue={{ text: row.value }}
          disabled={disabled || row.disabled} onPress={row.onPress} suppressWebHoverFeedback disableWebPressScale style={[styles.detailRow, { borderColor: colors.border, opacity: disabled || row.disabled ? 0.55 : 1 }]}>{content}</Pressable>
          : <View key={row.key} accessible accessibilityLabel={row.label ? `${row.label}: ${row.value}` : row.value} style={[styles.detailRow, { borderColor: colors.border }]}>{content}</View>;
      })}
      {extra}
    </ScrollView>
    {supportedActions.length ? <View style={[styles.actions, { backgroundColor: colors.inputBg }]}>
      {supportedActions.map(action => <DetailAction key={action.key} action={action} disabled={disabled} />)}
    </View> : null}
  </>;
}

const styles = StyleSheet.create({
  backBar: { height: 38, flexShrink: 0, paddingLeft: 4, justifyContent: "center" },
  header: { minHeight: metrics.touchTarget, flexDirection: "row", alignItems: "center", gap: metrics.gap, paddingHorizontal: metrics.smallGap },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  titleSlot: { flex: 1, minWidth: 0 }, titleAction: { minHeight: 44, justifyContent: "center", borderRadius: 12 },
  title: { minWidth: 0, fontSize: metrics.titleFontSize, lineHeight: metrics.titleLineHeight, fontWeight: "400" },
  accentAction: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 4 },
  scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0, borderRadius: 20, overflow: "hidden" }, body: { paddingHorizontal: 12, paddingBottom: metrics.smallGap },
  divider: { height: StyleSheet.hairlineWidth },
  period: { minHeight: 52, paddingVertical: metrics.smallGap, paddingLeft: 28, justifyContent: "center" },
  periodIcon: { position: "absolute", left: 4, top: 18 }, interval: { flexDirection: "row", alignItems: "center", gap: metrics.smallGap },
  endpoint: { flex: 1, minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: metrics.smallGap },
  editableEndpoint: { gap: metrics.smallGap }, endpointAction: { minHeight: metrics.touchTarget, minWidth: metrics.touchTarget, maxWidth: "100%", flexShrink: 1, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  date: { fontSize: metrics.metadataFontSize, lineHeight: metrics.metadataLineHeight, textAlign: "center" },
  time: { fontSize: 14, lineHeight: 20, fontVariant: ["tabular-nums"] },
  allDay: { marginTop: metrics.smallGap, fontSize: metrics.metadataFontSize, textAlign: "center" },
  detailRow: { minHeight: metrics.touchTarget, flexDirection: "row", alignItems: "flex-start", gap: metrics.gap, paddingLeft: metrics.smallGap, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: metrics.iconSize, height: 20, marginTop: 12, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, minWidth: 0, minHeight: metrics.touchTarget, paddingVertical: 13 }, value: { fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight },
  actions: { alignSelf: "stretch", flexShrink: 0, marginHorizontal: 4, minHeight: 56, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 4, gap: 0 },
  actionSlot: { flex: 1, minWidth: 44 },
  action: { minWidth: 44, minHeight: 56, paddingHorizontal: 2, paddingVertical: 4, borderRadius: 24, alignItems: "center", justifyContent: "center", gap: 3 },
  actionLabel: { maxWidth: "100%", fontSize: metrics.navigation.labelFontSize, lineHeight: 14, textAlign: "center" },
  menuItem: { minHeight: 44, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  menuText: { flex: 1, minWidth: 0, fontSize: metrics.bodyFontSize, lineHeight: metrics.bodyLineHeight },
});
