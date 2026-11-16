import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { compactUiMetrics } from "../../theme/tokens";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";
import { ASSISTANT_MODEL_CHOICES, type AssistantModelChoice } from "../model-choice";

export function AssistantModelSelector({ value, onChange, disabled = false, compact = false, keyboardNavigation = false }: {
  value: AssistantModelChoice; onChange: (value: AssistantModelChoice) => void; disabled?: boolean; compact?: boolean; keyboardNavigation?: boolean;
}) {
  const { colors } = useAppTheme();
  const anchor = useRef<View>(null);
  const list = useRef<View>(null);
  const listId = useId();
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [open, setOpen] = useState(false);
  const selected = ASSISTANT_MODEL_CHOICES.find(option => option.value === value)!;
  const focusTrigger = useCallback(() => {
    if (!keyboardNavigation || Platform.OS !== "web") return;
    (anchor.current as unknown as HTMLElement | null)?.querySelector<HTMLElement>('[role="button"]')?.focus({ preventScroll: true });
  }, [keyboardNavigation]);
  useEffect(() => {
    if (!keyboardNavigation || !open || disabled || Platform.OS !== "web") return;
    const node = list.current as unknown as HTMLElement | null;
    if (!node) return;
    const options = [...node.querySelectorAll<HTMLElement>('[role="button"]')];
    const focusedOption = options.find(option => option.getAttribute("aria-pressed") === "true") ?? options[0];
    focusedOption?.focus({ preventScroll: true });
    focusedOption?.scrollIntoView({ block: "nearest" });
    const move = (event: KeyboardEvent) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const index = options.indexOf((event.target as HTMLElement).closest<HTMLElement>('[role="button"]')!);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[next]?.focus({ preventScroll: true });
      options[next]?.scrollIntoView({ block: "nearest" });
    };
    // Handle Escape before the dropdown's document capture dismisses without a cause.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || (!node.contains(event.target as Node) && !(anchor.current as unknown as HTMLElement | null)?.contains(event.target as Node))) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      focusTrigger();
    };
    node.addEventListener("keydown", move);
    window.addEventListener("keydown", escape, true);
    return () => {
      node.removeEventListener("keydown", move);
      window.removeEventListener("keydown", escape, true);
    };
  }, [keyboardNavigation, open, disabled, focusTrigger]);
  const options = ASSISTANT_MODEL_CHOICES.map(option => <Pressable key={option.value} accessibilityRole="button"
    accessibilityLabel={option.label} accessibilityState={{ selected: option.value === value }}
    {...(keyboardNavigation ? { "aria-pressed": option.value === value, tabIndex: 0 as const } : {})}
    onPress={() => { onChange(option.value); setOpen(false); focusTrigger(); }} style={styles.option}>
    <View style={styles.copy}>
      <Text style={[styles.label, { color: colors.text }]}>{option.label}</Text>
      <Text style={[styles.detail, { color: colors.muted }]}>{option.detail}</Text>
    </View>
    {option.value === value ? <GoAtletaIcon name="checkmark" size={18} color={colors.text} /> : null}
  </Pressable>);
  return <View style={[styles.root, compact && styles.compactRoot]}>
    <View ref={anchor} collapsable={false}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Modelo: ${selected.label}`}
        {...(keyboardNavigation ? { "aria-expanded": open && !disabled, "aria-controls": open && !disabled ? listId : undefined } : {})}
        accessibilityState={{ expanded: open, disabled }} disabled={disabled}
        onPress={() => {
          if (open) { setOpen(false); return; }
          anchor.current?.measureInWindow((x, y, width, height) => { setLayout({ x, y, width, height }); setOpen(true); });
        }} style={[styles.trigger, compact && styles.compactTrigger, { opacity: disabled ? 0.55 : 1 }]}>
        <Text numberOfLines={1} style={[styles.title, compact && styles.compactTitle, { color: colors.text }]}>{selected.label}</Text>
        <GoAtletaIcon name="chevronDown" size={compact ? 13 : 16} color={colors.muted} />
      </Pressable>
    </View>
    <AnchoredDropdown visible={open && !disabled} layout={layout} container={{ x: 0, y: 0 }} animationStyle={{}}
      zIndex={6000} maxHeight={310} nestedScrollEnabled density="menu" preferredWidth={270}
      interactiveRefs={[anchor]} onRequestClose={() => setOpen(false)}>
      {keyboardNavigation ? <View ref={list} nativeID={listId} role="group" accessibilityLabel="Escolher modelo" style={{ gap: compactUiMetrics.smallGap }}>{options}</View> : options}
    </AnchoredDropdown>
  </View>;
}
const styles = StyleSheet.create({
  root: { alignSelf: "flex-start", maxWidth: "100%" },
  compactRoot: { alignSelf: "center" },
  trigger: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 38 },
  compactTrigger: { height: 44, minHeight: 44, gap: 3, paddingHorizontal: 4, justifyContent: "center" },
  title: { fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight, fontWeight: "700", flexShrink: 1 },
  compactTitle: { fontSize: 12, fontWeight: "600" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10 },
  copy: { flex: 1, minWidth: 0, gap: 3 }, label: { fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight, fontWeight: "600" }, detail: { fontSize: compactUiMetrics.metadataFontSize, lineHeight: compactUiMetrics.metadataLineHeight },
});
