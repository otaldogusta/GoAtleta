import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";

export function CalendarUnitSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const { colors } = useAppTheme();
  const trigger = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  return <>
    <View ref={trigger} collapsable={false} style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Unidade: ${value}`} accessibilityState={{ expanded: open }} onPress={() => {
        if (open) { setOpen(false); return; }
        trigger.current?.measureInWindow((x, y, width, height) => { setLayout({ x, y, width, height }); setOpen(true); });
      }} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Unidade</Text>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "600", flexShrink: 1 }}>{value}</Text>
        <GoAtletaIcon name="chevronDown" size={14} color={colors.muted} />
      </Pressable>
    </View>
    <AnchoredDropdown visible={open} layout={layout} container={null} animationStyle={{}} zIndex={4200} maxHeight={240} density="menu" nestedScrollEnabled fitContent preferredWidth={240} interactiveRefs={[trigger]} onRequestClose={() => setOpen(false)}>
      {options.map(option => <AnchoredDropdownOption key={option} active={option === value} accessibilityLabel={`Selecionar ${option}`} onPress={() => { onChange(option); setOpen(false); }}><Text style={{ color: option === value ? colors.primaryText : colors.text, fontSize: 13 }}>{option}</Text></AnchoredDropdownOption>)}
    </AnchoredDropdown>
  </>;
}
