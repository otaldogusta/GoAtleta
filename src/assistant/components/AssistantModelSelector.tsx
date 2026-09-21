import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";
import { ASSISTANT_MODEL_CHOICES, type AssistantModelChoice } from "../model-choice";

export function AssistantModelSelector({ value, onChange, disabled = false, compact = false }: {
  value: AssistantModelChoice; onChange: (value: AssistantModelChoice) => void; disabled?: boolean; compact?: boolean;
}) {
  const { colors } = useAppTheme();
  const anchor = useRef<View>(null);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [open, setOpen] = useState(false);
  const selected = ASSISTANT_MODEL_CHOICES.find(option => option.value === value)!;
  return <View style={[styles.root, compact && styles.compactRoot]}>
    <View ref={anchor} collapsable={false}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Modelo: ${selected.label}`}
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
      {ASSISTANT_MODEL_CHOICES.map(option => <Pressable key={option.value} accessibilityRole="button"
        accessibilityLabel={option.label} accessibilityState={{ selected: option.value === value }}
        onPress={() => { onChange(option.value); setOpen(false); }} style={styles.option}>
        <View style={styles.copy}>
          <Text style={[styles.label, { color: colors.text }]}>{option.label}</Text>
          <Text style={[styles.detail, { color: colors.muted }]}>{option.detail}</Text>
        </View>
        {option.value === value ? <GoAtletaIcon name="checkmark" size={18} color={colors.text} /> : null}
      </Pressable>)}
    </AnchoredDropdown>
  </View>;
}
const styles = StyleSheet.create({
  root: { alignSelf: "flex-start", maxWidth: "100%" },
  compactRoot: { alignSelf: "center" },
  trigger: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 38 },
  compactTrigger: { height: 44, minHeight: 44, gap: 3, paddingHorizontal: 4, justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  compactTitle: { fontSize: 12, fontWeight: "600" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10 },
  copy: { flex: 1, gap: 3 }, label: { fontSize: 14, fontWeight: "600" }, detail: { fontSize: 12 },
});
