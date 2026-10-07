import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../../ui/app-theme";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";

export function ScoutingTabs({ value, onChange, items, segmented = false }: { value: string; onChange: (value: string) => void; items: { value: string; label: string; id?: string }[]; segmented?: boolean }) {
  const { colors } = useAppTheme();
  return <View accessibilityRole={segmented ? undefined : "tablist"} style={{ flexDirection: "row", gap: segmented ? 2 : 20, alignSelf: "flex-start", padding: segmented ? 3 : 0, borderWidth: segmented ? 1 : 0, borderRadius: 12, borderColor: colors.border }}>
    {items.map(item => <Pressable key={item.value} nativeID={item.id} accessibilityRole={segmented ? "button" : "tab"} accessibilityState={{ selected: value === item.value }} onPress={() => onChange(item.value)}
      style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: segmented ? 20 : 0, borderRadius: segmented ? 9 : 0, backgroundColor: segmented && value === item.value ? colors.surfaceElevated : "transparent", borderBottomWidth: segmented ? 0 : 2, borderBottomColor: !segmented && value === item.value ? colors.text : "transparent" }}>
      <Text style={{ fontSize: 14, fontWeight: value === item.value ? "600" : "400", color: value === item.value ? colors.text : colors.muted }}>{item.label}</Text>
    </Pressable>)}
  </View>;
}
export function ScoutingSelect({ label, value, options, onChange, calendar, outlined }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; calendar?: boolean; outlined?: boolean }) {
  const { colors } = useAppTheme();
  const trigger = useRef<View>(null);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [open, setOpen] = useState(false);
  const close = () => { setOpen(false); (trigger.current as unknown as HTMLElement | null)?.querySelector?.<HTMLElement>('[role="button"]')?.focus(); };
  return <>
    <View ref={trigger} collapsable={false}><Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${options.find(o => o.value === value)?.label ?? value}`} accessibilityState={{ expanded: open }} onPress={() => { if (open) close(); else trigger.current?.measureInWindow((x, y, width, height) => { setLayout({ x, y, width, height }); setOpen(true); }); }}
      style={{ minHeight: 40, paddingHorizontal: outlined ? 12 : 0, borderWidth: outlined ? 1 : 0, borderRadius: 8, borderColor: colors.border, flexDirection: "row", gap: 10, alignItems: "center" }}>
      {calendar ? <GoAtletaIcon name="calendar" size={16} color={colors.muted} /> : null}
      <Text style={{ fontSize: 12, color: colors.text }}>{options.find(o => o.value === value)?.label ?? value}</Text><GoAtletaIcon name="chevronDown" size={14} color={colors.muted} />
    </Pressable></View>
    <AnchoredDropdown visible={open} layout={layout} container={null} animationStyle={{}} zIndex={12500} maxHeight={280} nestedScrollEnabled fitContent density="menu" preferredWidth={220} interactiveRefs={[trigger]} onRequestClose={close}>
      {options.map(option => <AnchoredDropdownOption key={option.value} active={option.value === value} accessibilityLabel={option.label} density="compact" onPress={() => { onChange(option.value); close(); }}>
        <Text style={{ fontSize: 13, color: option.value === value ? colors.primaryText : colors.text }}>{option.label}</Text>
      </AnchoredDropdownOption>)}
    </AnchoredDropdown>
  </>;
}
