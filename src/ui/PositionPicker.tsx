import { useId, useRef, useState } from "react";
import { Platform, Text, TextInput, View, type TextStyle } from "react-native";
import { AnchoredDropdown } from "./AnchoredDropdown";
import { AnchoredDropdownOption } from "./AnchoredDropdownOption";
import { useAppTheme } from "./app-theme";
import { Pressable } from "./Pressable";
import { GoAtletaIcon } from "./icon-registry";
import { useDisclosureMotion } from "./useDisclosureMotion";

export function PositionPicker<T extends string>({ value, options, onChange, lockedValues = [], maxSelections = 2, searchLabel = "Pesquisar posições" }: {
  value: T[];
  options: readonly { value: T; label: string }[];
  onChange: (value: T[]) => void;
  maxSelections?: number;
  searchLabel?: string;
  lockedValues?: T[];
}) {
  const { colors } = useAppTheme();
  const anchor = useRef<View>(null);
  const listId = useId();
  const input = useRef<TextInput>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const motion = useDisclosureMotion(open);
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const selected = [...new Set(value)].map((position) => options.find((option) => option.value === position)).filter((option) => !!option);
  const filtered = options.filter((option) => option.value !== "indefinido" && !value.includes(option.value) && normalize(option.label).includes(normalize(query)));
  const show = () => anchor.current?.measureInWindow((x, y, width, height) => {
    setLayout({ x, y, width, height });
    setOpen(true);
  });
  const select = (position: T) => {
    if (value.length < maxSelections) onChange([...value, position]);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  };
  return (
    <View>
      <View ref={anchor} collapsable={false} style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 14, paddingVertical: 6, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {selected.map((option) => <View key={option.value} style={{ flexDirection: "row", alignItems: "center", borderRadius: 18, backgroundColor: colors.primaryBg, paddingLeft: 12 }}>
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>{option.label}</Text>
          {lockedValues.includes(option.value) ? <Text accessibilityLabel={`${option.label}: vinculada a um plano ativo`} style={{ color: colors.primaryText, paddingHorizontal: 12, paddingVertical: 12, fontSize: 11 }}>Plano</Text> : <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={`Remover ${option.label}`} onPress={() => onChange(value.filter((position) => position !== option.value))} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <GoAtletaIcon name="close" size={16} color={colors.primaryText} />
          </Pressable>}
        </View>)}
        {selected.length < maxSelections ? <>
          <TextInput ref={input} accessibilityLabel={searchLabel} placeholder={searchLabel} placeholderTextColor={colors.muted} value={query} onFocus={show}
            onChangeText={(text) => { setQuery(text); setActiveIndex(0); show(); }}
            onKeyPress={(event) => {
              const key = event.nativeEvent.key;
              if (key === "Escape") { setOpen(false); return; }
              if (key === "ArrowDown" || key === "ArrowUp") {
                event.preventDefault();
                if (!open) { setActiveIndex(0); show(); }
                else setActiveIndex((index) => Math.max(0, Math.min(filtered.length - 1, index + (key === "ArrowDown" ? 1 : -1))));
                return;
              }
              const shiftKey = (event.nativeEvent as unknown as { shiftKey?: boolean }).shiftKey;
              if (open && filtered[activeIndex] && (key === "Enter" || (key === "Tab" && !shiftKey && query.trim()))) {
                event.preventDefault();
                select(filtered[activeIndex].value);
              } else if (key === "Tab") setOpen(false);
            }}
            style={{ flex: 1, minWidth: 120, minHeight: 40, borderRadius: 0, color: colors.text, paddingVertical: 0, ...(Platform.OS === "web" ? { outlineStyle: "none", boxShadow: "none" } : {}) } as TextStyle}
          />
          <GoAtletaIcon name="search" size={20} color={open ? colors.primaryBg : colors.muted} />
        </> : null}
      </View>
      <AnchoredDropdown activeItemId={filtered[activeIndex] ? `${listId}-${filtered[activeIndex].value}` : undefined} visible={motion.mounted} layout={layout} container={null} animationStyle={motion.style} zIndex={4000} maxHeight={300} fitContent nestedScrollEnabled onRequestClose={() => setOpen(false)} interactiveRefs={[anchor]}>
        <View pointerEvents={open ? "auto" : "none"} accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"}>
        {filtered.map((option, index) => (
          <View key={option.value} nativeID={`${listId}-${option.value}`}>
          <AnchoredDropdownOption active={index === activeIndex} onPress={() => select(option.value)}>
            <Text style={{ color: index === activeIndex ? colors.primaryText : colors.text }}>{option.label}</Text>
          </AnchoredDropdownOption>
          </View>
        ))}
        {!filtered.length ? <Text style={{ padding: 12, color: colors.muted }}>Nenhuma opção encontrada.</Text> : null}
        </View>
      </AnchoredDropdown>
    </View>
  );
}
