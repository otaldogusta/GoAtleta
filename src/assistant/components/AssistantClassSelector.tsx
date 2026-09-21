import { useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import type { ClassGroup } from "../../core/models";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

type Props = {
  classes: ClassGroup[];
  value: string;
  onChange: (classId: string) => void;
  normalizeLabel: (name: string) => string;
  compact?: boolean;
  inlinePrompt?: boolean;
};

export function AssistantClassSelector({ classes, value, onChange, normalizeLabel, compact = false, inlinePrompt = false }: Props) {
  const { colors } = useAppTheme();
  const anchor = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const options = useMemo(
    () => [...classes].sort((left, right) =>
      normalizeLabel(left.name).localeCompare(normalizeLabel(right.name), "pt-BR", { sensitivity: "base" })
    ),
    [classes, normalizeLabel]
  );
  const selected = classes.find((item) => item.id === value) ?? classes[0];
  if (!selected) return null;
  const selectedLabel = normalizeLabel(selected.name) || selected.name;
  const toggleDropdown = () => {
    if (open) {
      setOpen(false);
      return;
    }
    anchor.current?.measureInWindow((x, y, width, height) => {
      setLayout({ x, y, width, height });
      setOpen(true);
    });
  };

  return (
    <View style={[styles.root, compact && styles.compactRoot, inlinePrompt && styles.inlineRoot]}>
      {inlinePrompt ? (
        <View style={styles.inlineSentence}>
          <Text style={[styles.inlineText, { color: colors.muted }]}>O que vamos criar para </Text>
          <View ref={anchor} collapsable={false} style={styles.inlineAnchor}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Selecionar turma. Atual: ${selectedLabel}`}
              accessibilityState={{ expanded: open }}
              onPress={toggleDropdown}
              style={[
                styles.inlineClassTrigger,
                Platform.OS === "web" ? ({ outlineStyle: "none", boxShadow: "none" } as never) : null,
              ]}
            >
              <Text style={[styles.inlineClass, { color: colors.text }]}>{selectedLabel}</Text>
            </Pressable>
          </View>
          <Text style={[styles.inlineText, { color: colors.muted }]}>?</Text>
        </View>
      ) : <View ref={anchor} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Selecionar turma. Atual: ${selectedLabel}`}
          accessibilityState={{ expanded: open }}
          onPress={toggleDropdown}
          style={[
            styles.trigger,
            compact && styles.compactTrigger,
            {
              backgroundColor: compact ? "transparent" : colors.inputBg,
              borderColor: compact ? "transparent" : colors.border,
              ...(Platform.OS === "web" ? ({ outlineStyle: "none", boxShadow: "none" } as never) : {}),
            },
          ]}
        >
          <View style={[styles.triggerCopy, compact && styles.compactCopy]}>
            {!compact ? <Text style={[styles.eyebrow, { color: colors.muted }]}>Turma ativa</Text> : null}
            {compact ? <GoAtletaIcon name="students" size={15} color={colors.muted} /> : null}
            <Text numberOfLines={1} style={[styles.selectedLabel, compact && styles.compactLabel, { color: colors.text }]}>{selectedLabel}</Text>
          </View>
          {!compact ? <Text style={[styles.count, { color: colors.muted }]}>{classes.length} turmas</Text> : null}
          <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} />
        </Pressable>
      </View>}

      <AnchoredDropdown
        visible={open}
        layout={layout}
        container={{ x: 0, y: 0 }}
        animationStyle={{}}
        zIndex={6500}
        maxHeight={420}
        nestedScrollEnabled
        density="popover"
        fitContent
        preferredWidth={inlinePrompt ? 360 : undefined}
        activeItemId={`assistant-class-${value}`}
        interactiveRefs={[anchor]}
        onRequestClose={() => setOpen(false)}
        scrollContentStyle={styles.options}
      >
        {options.map((item) => {
          const active = item.id === value;
          const label = normalizeLabel(item.name) || item.name;
          return (
            <Pressable
              key={item.id}
              nativeID={`assistant-class-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                onChange(item.id);
                setOpen(false);
              }}
              style={[
                styles.option,
                { backgroundColor: active ? colors.secondaryBg : colors.card },
              ]}
            >
              <View style={styles.optionCopy}>
                <Text numberOfLines={1} style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
                <Text numberOfLines={1} style={[styles.optionMeta, { color: colors.muted }]}>
                  {[item.modality, item.startTime].filter(Boolean).join(" · ") || "Contexto da turma"}
                </Text>
              </View>
              {active ? <GoAtletaIcon name="checkmark" size={18} color={colors.primaryBg} /> : null}
            </Pressable>
          );
        })}
      </AnchoredDropdown>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", maxWidth: 420, alignSelf: "center" },
  compactRoot: { maxWidth: "100%", alignSelf: "stretch" },
  inlineRoot: { width: "auto", maxWidth: "100%", alignSelf: "center" },
  trigger: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  triggerCopy: { flex: 1, minWidth: 0, gap: 1 },
  compactTrigger: { minHeight: 32, borderWidth: 0, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  compactCopy: { flexDirection: "row", alignItems: "center", gap: 7 },
  eyebrow: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  selectedLabel: { fontSize: 14, fontWeight: "700" },
  compactLabel: { fontSize: 12, fontWeight: "600" },
  inlineSentence: { minHeight: 40, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center" },
  inlineText: { fontSize: 16, lineHeight: 24 },
  inlineAnchor: { alignSelf: "center" },
  inlineClassTrigger: { minHeight: 40, justifyContent: "center" },
  inlineClass: { fontSize: 16, lineHeight: 24, fontWeight: "600", textDecorationLine: "underline" },
  count: { fontSize: 12 },
  options: { padding: 6, gap: 2 },
  option: {
    minHeight: 50,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionCopy: { flex: 1, minWidth: 0, gap: 2 },
  optionLabel: { fontSize: 14, fontWeight: "700" },
  optionMeta: { fontSize: 12 },
});
