import { useEffect, useId, useRef, useState } from "react";
import { View, type ViewProps } from "react-native";
import { AnchoredDropdown } from "./AnchoredDropdown";
import { OperationalText as Text } from "./OperationalText";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";
import { GoAtletaIcon } from "./icon-registry";

/** Compact filter trigger, following the selector in Scouting. */
export function CompactSelect({ label, value, options, onChange, nativeID, testID }: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  nativeID?: string;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  const trigger = useRef<View>(null);
  const list = useRef<View>(null);
  const leavingByTab = useRef(false);
  const listId = useId();
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [open, setOpen] = useState(false);
  const currentLabel = options.find((option) => option.value === value)?.label ?? value;
  const close = () => {
    setOpen(false);
    if (leavingByTab.current) return;
    (trigger.current as unknown as HTMLElement | null)?.querySelector?.<HTMLElement>('[role="button"]')?.focus();
  };
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const node = list.current as unknown as HTMLElement | null;
    if (!node) return;
    const entries = [...node.querySelectorAll<HTMLElement>('[role="option"]')];
    (entries.find((entry) => entry.getAttribute("aria-selected") === "true") ?? entries[0])?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      const index = entries.indexOf((event.target as HTMLElement).closest<HTMLElement>('[role="option"]')!);
      if (index < 0) return;
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length;
        entries[next]?.focus({ preventScroll: true });
        entries[next]?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        onChange(options[index].value);
        setOpen(false);
        (trigger.current as unknown as HTMLElement | null)?.querySelector<HTMLElement>('[role="button"]')?.focus();
      } else if (event.key === "Tab") {
        event.preventDefault();
        leavingByTab.current = true;
        const button = (trigger.current as unknown as HTMLElement | null)?.querySelector<HTMLElement>('[role="button"]');
        const scope = button?.closest('[role="dialog"]') ?? document.body;
        const targets = [...scope.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"]')]
          .filter((target) => !node.contains(target) && !target.closest('[inert], [aria-hidden="true"]') && !target.matches(':disabled, [aria-disabled="true"]') && target.getClientRects().length > 0);
        const position = button ? targets.indexOf(button) : -1;
        setOpen(false);
        (targets[(position + (event.shiftKey ? -1 : 1) + targets.length) % targets.length] ?? button)?.focus();
      }
    };
    node.addEventListener("keydown", keydown);
    return () => node.removeEventListener("keydown", keydown);
  }, [open, onChange, options]);
  return <>
    <View ref={trigger} collapsable={false} style={{ minWidth: 0, flexShrink: 1 }}>
      <Pressable nativeID={nativeID} testID={testID} accessibilityRole="button"
        accessibilityLabel={`${label}: ${currentLabel}`} aria-haspopup="listbox" aria-controls={open ? listId : undefined} aria-expanded={open}
        accessibilityState={{ expanded: open }} suppressWebHoverFeedback
        onPress={() => {
          if (open) close();
          else trigger.current?.measureInWindow((x, y, width, height) => {
            leavingByTab.current = false;
            setLayout({ x, y, width, height });
            setOpen(true);
          });
        }}
        style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 2 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, flexShrink: 1 }}>{currentLabel}</Text>
        <GoAtletaIcon name="chevronDown" size={14} color={colors.muted} />
      </Pressable>
    </View>
    <AnchoredDropdown visible={open} layout={layout} container={null} animationStyle={{}} zIndex={12500}
      maxHeight={320} nestedScrollEnabled fitContent density="menu" preferredWidth={240}
      interactiveRefs={[trigger]} onRequestClose={close}>
      <View ref={list} nativeID={listId} role={"listbox" as ViewProps["role"]} accessibilityLabel={label}>
      {options.map((option) => <Pressable key={option.value} role="option" aria-selected={option.value === value}
        accessibilityLabel={option.label} tabIndex={-1} onPress={() => { onChange(option.value); close(); }}
        style={{ minHeight: 44, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 8, backgroundColor: option.value === value ? colors.secondaryBg : "transparent" }}>
        <Text style={{ fontSize: 12, color: colors.text }}>{option.label}</Text>
        {option.value === value ? <GoAtletaIcon name="checkmark" size={16} color={colors.text} /> : null}
      </Pressable>)}
      </View>
    </AnchoredDropdown>
  </>;
}
